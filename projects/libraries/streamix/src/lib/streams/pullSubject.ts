import { createReceiver, createSubscription, Operator, pipeStream, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export function createBaseSubject<T = any>() {
  return {
    buffer: [] as T[],
    subscribers: new Map(),
    pullRequests: new Map(),
    completed: false,
    hasError: false,
    errorValue: null
  };
}

export function createSubject<T = any>(): Subject<T> {
  const base = createBaseSubject<T>();

  const next = (value: T) => {
    if (base.completed || base.hasError) return;
    base.buffer.push(value);
    processPullRequests();
  };

  const complete = () => {
    if (base.completed) return;
    base.completed = true;
    processPullRequests();
  };

  const error = (err: any) => {
    if (base.completed || base.hasError) return;
    base.hasError = true;
    base.errorValue = err;
    for (const { reject } of base.pullRequests.values()) {
      reject(err);
    }
    base.pullRequests.clear();
  };

  const pullValue = async function (receiver: Receiver<T>): Promise<IteratorResult<T, void>> {
    if (base.hasError) return Promise.reject(base.errorValue);

    const { startIndex, endIndex } = base.subscribers.get(receiver) ?? { startIndex: 0, endIndex: Infinity };
    if (startIndex >= endIndex) return Promise.resolve({ value: undefined, done: true });

    if (startIndex < base.buffer.length) {
      const value = base.buffer[startIndex];
      base.subscribers.set(receiver, { startIndex: startIndex + 1, endIndex });
      return Promise.resolve({ value, done: false });
    }

    if (base.completed) return Promise.resolve({ value: undefined, done: true });

    return new Promise<IteratorResult<T, void>>((resolve, reject) => {
      base.pullRequests.set(receiver, { resolve, reject });
    });
  };

  const processPullRequests = () => {
    for (const [receiver, request] of base.pullRequests.entries()) {
      if (receiver.unsubscribed) {
        base.pullRequests.delete(receiver);
        continue;
      }
      pullValue(receiver).then(request.resolve).catch(request.reject);
      base.pullRequests.delete(receiver);
    }
  };

  const cleanupBuffer = () => {
    const minIndex = Math.min(...Array.from(base.subscribers.values(), ({ startIndex }) => startIndex ?? Infinity));
    if (minIndex > 0) {
      base.buffer.splice(0, minIndex);
      for (const receiver of base.subscribers.keys()) {
        const { startIndex, endIndex } = base.subscribers.get(receiver) ?? { startIndex: 0, endIndex: Infinity };
        base.subscribers.set(receiver, { startIndex: startIndex - minIndex, endIndex: endIndex - minIndex });
      }
    }
  };

  const cleanupAfterReceiver = (receiver: Receiver<T>) => {
    const subscriptionState = base.subscribers.get(receiver);
    if (subscriptionState && subscriptionState.startIndex >= subscriptionState.endIndex) {
      base.subscribers.delete(receiver);
      base.pullRequests.delete(receiver);
      cleanupBuffer();
    }
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const currentStartIndex = base.buffer.length;
    base.subscribers.set(receiver, { startIndex: currentStartIndex, endIndex: Infinity });

    const subscription = createSubscription(
      () => base.buffer[base.buffer.length - 1],
      () => {
        if (!receiver.unsubscribed) {
          receiver.unsubscribed = true;
          const subscriptionState = base.subscribers.get(receiver)!;
          subscriptionState.endIndex = base.buffer.length;
          base.subscribers.set(receiver, subscriptionState);
          base.pullRequests.delete(receiver);
          cleanupBuffer();
        }
      }
    );

    (async () => {
      try {
        while (true) {
          const subscriptionState = base.subscribers.get(receiver);
          if (!subscriptionState || subscriptionState.startIndex >= subscriptionState.endIndex) {
            break;
          }
          const result = await pullValue(receiver);
          if (result.done) break;
          receiver.next(result.value);
        }
      } catch (err: any) {
        receiver.error(err);
      } finally {
        receiver.complete();
        cleanupAfterReceiver(receiver);
      }
    })();

    return subscription;
  };

  const asyncIterator = async function* () {
    const receiver = createReceiver();
    base.subscribers.set(receiver, { startIndex: base.buffer.length, endIndex: Infinity });

    try {
      while (true) {
        const subscriptionState = base.subscribers.get(receiver);
        if (!subscriptionState || subscriptionState.startIndex >= subscriptionState.endIndex) {
          break;
        }
        const result = await pullValue(receiver);
        if (result.done) break;
        yield result.value;
      }
    } catch (err: any) {
        receiver.error(err);
    } finally {
        receiver.unsubscribed = true;
        cleanupAfterReceiver(receiver);
    }
  };

  const stream: Subject<T> = {
    type: "subject",
    name: "subject",
    [Symbol.asyncIterator]: asyncIterator,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(stream, ...steps),
    value: () => base.buffer[base.buffer.length - 1],
    next,
    complete,
    completed: () => base.completed,
    error
  };

  return stream;
}
