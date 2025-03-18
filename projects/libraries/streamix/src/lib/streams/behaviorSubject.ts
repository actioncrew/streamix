import { createReceiver, createSubscription, Operator, pipeStream, Receiver, StreamMapper, Subscription } from "../abstractions";
import { createBaseSubject, Subject } from "../streams";

export type BehaviorSubject<T> = Subject<T> & {
  getValue(): T;
};

export function createBehaviorSubject<T>(initialValue: T): BehaviorSubject<T> {
  // Create the base subject internals
  const base = createBaseSubject<T>();

  // Initialize with the initial value
  base.buffer.push(initialValue);

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

  // Modified subscribe method to emit current value immediately
  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);

    // Set startIndex to the last buffer index, so new subscriber gets only the latest value
    base.subscribers.set(receiver, { startIndex: base.buffer.length - 1, endIndex: Infinity });

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

  // Buffer cleanup specific to this subject
  const cleanupBuffer = () => {
    // For BehaviorSubject, always keep at least the latest value
    const minIndex = Math.min(
      ...Array.from(base.subscribers.values(), ({ startIndex }) => startIndex ?? Infinity),
      base.buffer.length - 1 // Always keep the last value
    );

    if (minIndex > 0) {
      base.buffer.splice(0, minIndex);
      for (const receiver of base.subscribers.keys()) {
        const { startIndex, endIndex } = base.subscribers.get(receiver) ?? { startIndex: 0, endIndex: Infinity };
        base.subscribers.set(receiver, { startIndex: startIndex - minIndex, endIndex: endIndex - minIndex });
      }
    }
  };

  // Cleanup after a receiver unsubscribes
  const cleanupAfterReceiver = (receiver: Receiver<T>) => {
    const subscriptionState = base.subscribers.get(receiver);
    if (subscriptionState && subscriptionState.startIndex >= subscriptionState.endIndex) {
      base.subscribers.delete(receiver);
      base.pullRequests.delete(receiver);
      cleanupBuffer(); // Clean up the buffer to avoid memory leaks
    }
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

  // Modified async iterator to emit current value first
  const asyncIterator = async function* () {
    const receiver = createReceiver();

    // For BehaviorSubject, start from the latest value
    base.subscribers.set(receiver, { startIndex: base.buffer.length - 1, endIndex: Infinity });

    try {
      // First yield the current value
      const currentValue = base.buffer[base.buffer.length - 1];
      yield currentValue;

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

  // Get the current value
  const getValue = () => base.buffer[base.buffer.length - 1];

  // Return the stream with public API and exposed private methods prefixed with _
  const behaviorSubject: BehaviorSubject<T> = {
    type: "subject",
    name: "behaviorSubject",
    [Symbol.asyncIterator]: asyncIterator,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(behaviorSubject, ...steps),
    value: getValue,
    getValue,
    next,
    complete,
    completed: () => base.completed,
    error,
  };

  return behaviorSubject;
}
