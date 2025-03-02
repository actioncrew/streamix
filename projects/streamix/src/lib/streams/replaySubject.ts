import { createEmission, createReceiver, createSubscription, Receiver } from "../abstractions";
import { Subject } from "../streams";

export type ReplaySubject<T = any> = Subject<T>;

export function createReplaySubject<T = any>(bufferSize: number = Infinity): ReplaySubject<T> {
  let subscribers: Receiver<T>[] = [];
  let buffer: T[] = [];
  let completed = false;
  let hasError = false;
  let errorValue: any = null;
  let emissionCounter = 0;

  const next = (value: T) => {
    if (completed || hasError) return;
    buffer.push(value);
    if (buffer.length > bufferSize) {
      buffer.shift();
    }
    emissionCounter++;
    subscribers.forEach((subscriber) => subscriber.next?.(value));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed);
  };

  const complete = () => {
    if (completed) return;
    completed = true;
    subscribers.forEach((subscriber) => subscriber.complete?.());
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed);
  };

  const error = (err: any) => {
    if (completed || hasError) return;
    hasError = true;
    errorValue = err;
    subscribers.forEach((subscriber) => subscriber.error?.(err));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed);
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    subscribers.push(receiver);

    // Replay buffer to new subscriber
    buffer.forEach((value) => receiver.next?.(value));

    if (hasError) {
      receiver.error?.(errorValue);
    }

    if (completed) {
      receiver.complete?.();
    }

    return createSubscription(() => buffer[buffer.length - 1], () => {
      if (!receiver.unsubscribed) {
        receiver.unsubscribed = true;
        subscribers = subscribers.filter((sub) => sub !== receiver);
      }
    });
  };

  const asyncIterator = async function* (this: ReplaySubject<T>): AsyncGenerator<Emission<T>, void, unknown> {
    let resolveNext: ((value: IteratorResult<Emission<T>>) => void) | null = null;
    let rejectNext: ((reason?: any) => void) | null = null;

    const queue: Emission<T>[] = buffer.map((value) => createEmission({ value }));
    let isWaiting = false;

    const receiver = createReceiver({
      next: (value: T) => {
        const emission = createEmission({ value });

        if (resolveNext) {
          resolveNext({ value: emission, done: false });
          resolveNext = null;
        } else {
          queue.push(emission);
        }
      },
      complete: () => {
        if (resolveNext) {
          resolveNext({ value: undefined as any, done: true });
        } else {
          queue.push(undefined as any);
        }
      },
      error: (err: Error) => {
        if (rejectNext) {
          rejectNext(err);
        }
      }
    });

    const subscription = this.subscribe(receiver);

    try {
      while (true) {
        if (queue.length > 0) {
          const emission = queue.shift()!;
          if (emission === undefined) break;
          yield emission;
        } else {
          isWaiting = true;
          await new Promise<void>((resolve, reject) => {
            resolveNext = (result) => {
              if (!result.done) queue.push(result.value);
              isWaiting = false;
              resolve();
            };
            rejectNext = (error) => {
              isWaiting = false;
              reject(error);
            };
          });
        }
      }
    } finally {
      subscription.unsubscribe();
    }
  };

  const stream: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    emissionCounter,
    [Symbol.asyncIterator]: asyncIterator,
    subscribe,
    pipe: (...steps: (Operator | StreamOperator)[]) => pipeStream(stream, ...steps),
    value: () => buffer[buffer.length - 1],
    next,
    complete,
    completed: () => completed,
    error,
  };

  return stream;
}
                        
