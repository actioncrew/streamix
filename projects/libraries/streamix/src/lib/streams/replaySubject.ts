import {
  createReceiver,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  StreamMapper,
  Subscription,
} from "../abstractions";
import { Subject } from "../streams";

export type ReplaySubject<T = any> = Subject<T>;

export function createReplaySubject<T = any>(bufferSize: number = Infinity): ReplaySubject<T> {
  let subscribers: Receiver<T>[] = [];
  let buffer: T[] = [];
  let completed = false;
  let hasError = false;
  let errorValue: any = null;

  // Emit a new value to all subscribers
  const next = (value: T) => {
    if (completed || hasError) return; // Prevent emitting if the stream is completed or in error state
    buffer.push(value);
    if (buffer.length > bufferSize) {
      buffer.shift(); // Maintain the buffer size
    }

    subscribers.forEach((subscriber) => subscriber.next?.(value));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed); // Clean up unsubscribed receivers
  };

  // Complete the stream
  const complete = () => {
    if (completed) return; // If already completed or in error state, do nothing
    completed = true;
    subscribers.forEach((subscriber) => subscriber.complete?.());
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed); // Clean up
  };

  // Emit an error to all subscribers
  const error = (err: any) => {
    if (completed || hasError) return; // Prevent emitting errors if the stream is completed or in error state
    hasError = true;
    errorValue = err;
    subscribers.forEach((subscriber) => subscriber.error?.(err));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed); // Clean up
  };

  // Subscribe to the ReplaySubject
  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    subscribers.push(receiver);

    // Replay the buffer to the new subscriber
    buffer.forEach((value) => receiver.next?.(value));

    if (hasError) {
      receiver.error?.(errorValue); // If the stream has errored, emit the error immediately
    }

    if (completed) {
      receiver.complete?.(); // If completed, notify the subscriber
    }

    return createSubscription(
      () => buffer[buffer.length - 1], // Get the latest value
      () => {
        if (!receiver.unsubscribed) {
          receiver.unsubscribed = true;
          subscribers = subscribers.filter((sub) => sub !== receiver); // Clean up
        }
      }
    );
  };

  // Async Iterator Implementation
  const asyncIterator = async function* (this: ReplaySubject<T>): AsyncGenerator<T, void, unknown> {
    let resolveNext: ((value: IteratorResult<T>) => void) | null = null;
    let rejectNext: ((reason?: any) => void) | null = null;

    const queue: T[] = [];
    let isCompleted = false;

    const receiver = createReceiver({
      next: (value: T) => {

        if (resolveNext) {
          // If there's a pending promise, resolve it with the new emission
          resolveNext({ value, done: false });
          resolveNext = null;
        } else {
          // Otherwise, add the emission to the queue
          queue.push(value);
        }
      },
      complete: () => {
        isCompleted = true;
        if (resolveNext) {
          // Resolve the pending promise with a done signal
          resolveNext({ value: undefined, done: true });
          resolveNext = null;
        }
      },
      error: (err: Error) => {
        if (rejectNext) {
          // Reject the pending promise with the error
          rejectNext(err);
          rejectNext = null;
        }
      },
    });

    // Subscribe to the ReplaySubject
    const subscription = this.subscribe(receiver);

    try {
      // Replay the buffer to the async iterator
      for (const value of buffer) {
        yield value;
      }

      // Process new emissions
      while (true) {
        if (queue.length > 0) {
          // Yield emissions from the queue
          const emission = queue.shift()!;
          yield emission;
        } else if (isCompleted) {
          // If completed, break the loop
          break;
        } else {
          // Wait for new emissions
          const result = await new Promise<IteratorResult<T>>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });

          if (result.done) {
            break;
          } else {
            yield result.value;
          }
        }
      }
    } finally {
      // Clean up the subscription
      subscription.unsubscribe();
    }
  };

  const stream: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    [Symbol.asyncIterator]: asyncIterator,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(stream, ...steps),
    value: () => buffer[buffer.length - 1], // Get the latest value
    next,
    complete,
    completed: () => completed,
    error,
  };

  return stream;
}
