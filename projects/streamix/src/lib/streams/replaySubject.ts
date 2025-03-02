import { createEmission, createReceiver, createSubscription, Emission, Operator, pipeStream, Receiver, Stream, StreamOperator, Subscription } from "../abstractions";
import { Subject } from '../streams';

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

    // Replay the buffer to the new subscriber
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
        if (!completed) {
          completed = true;
          subscribers.forEach((subscriber) => subscriber.complete?.());
        }
        subscribers = subscribers.filter((sub) => sub !== receiver);
      }
    });
  };

  const asyncIterator = async function* (this: ReplaySubject<T>): AsyncGenerator<Emission<T>, void, unknown> {
    let resolveNext: ((value: IteratorResult<Emission<T>>) => void) | null = null;
    let rejectNext: ((reason?: any) => void) | null = null;
    let latestValue: T | undefined;
    let hasNewValue = false;
    let completedHandled = false;

    const receiver = createReceiver({
      next: (value: T) => {
        latestValue = value;
        hasNewValue = true;
        if (resolveNext) {
          const emission = createEmission({ value });
          resolveNext({ value: emission, done: false });
          resolveNext = null;
          hasNewValue = false;
        }
      },

      complete: () => {
        completedHandled = true;
        if (resolveNext) {
          resolveNext({ value: createEmission({ value: undefined }), done: true });
        }
      },

      error: (err: Error) => {
        if (rejectNext) {
          rejectNext(err);
          rejectNext = null;
        }
      }
    });

    const subscription = this.subscribe(receiver);

    try {
      while (!completedHandled || hasNewValue) {
        if (hasNewValue) {
          yield createEmission({ value: latestValue! });
          hasNewValue = false;
        } else {
          const result = await new Promise<IteratorResult<Emission<T>>>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });
          if (result.done) break;
          yield result.value;
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
