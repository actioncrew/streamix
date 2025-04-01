import { createReceiver, createSubscription, Operator, pipeStream, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  peek(subscription?: Subscription): T | undefined;
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export function createBaseSubject<T = any>() {
  const base = {
    buffer: [] as T[],
    subscribers: new Map<Receiver<T>, { startIndex: number; endIndex: number }>(),
    pullRequests: new Map<Receiver<T>, { resolve: (value: IteratorResult<T, void>) => void; reject: (reason?: any) => void }>(),
    completed: false,
    hasError: false,
    errorValue: null as any,
  };

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

  const pullValue = async (receiver: Receiver<T>): Promise<IteratorResult<T, void>> => {
    if (base.hasError) return Promise.reject(base.errorValue);

    // Fetch the start and end indices for the subscriber
    const { startIndex, endIndex } = base.subscribers.get(receiver) ?? { startIndex: 0, endIndex: Infinity };

    // If the receiver's startIndex is beyond the available buffer
    if (startIndex >= base.buffer.length) {
      if (base.completed) {
        return Promise.resolve({ value: undefined, done: true });
      }

      // If the buffer is not yet complete, wait for new values to be pushed
      return new Promise<IteratorResult<T, void>>((resolve, reject) => {
        base.pullRequests.set(receiver, { resolve, reject });

        // Cleanup if unsubscribed before pull request resolves
        const originalComplete = receiver.complete!;
        receiver.complete = () => {
          originalComplete.call(receiver);
          if (base.pullRequests.has(receiver)) {
            resolve({ value: undefined, done: true });
            base.pullRequests.delete(receiver);
          }
        };
      });
    }

    // Fetch the next value from the buffer if available
    const value = base.buffer[startIndex];
    base.subscribers.set(receiver, { startIndex: startIndex + 1, endIndex });

    return Promise.resolve({ value, done: false });
  };

  const processPullRequests = () => {
    for (const [receiver, request] of base.pullRequests.entries()) {
      if (receiver.completed) {
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

      // Resolve any pending pull requests for this receiver
      if (base.pullRequests.has(receiver)) {
        const { resolve } = base.pullRequests.get(receiver)!;
        resolve({ value: undefined, done: true });
        base.pullRequests.delete(receiver);
      }

      cleanupBuffer();
    }
  };

  return {
    base,
    next,
    complete,
    error,
    pullValue,
    processPullRequests,
    cleanupBuffer,
    cleanupAfterReceiver,
  };
}

export function createSubject<T = any>(): Subject<T> {
  const { base, next, complete, error, pullValue, cleanupBuffer, cleanupAfterReceiver } = createBaseSubject<T>();

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    let latestValue: T | undefined;

    const currentStartIndex = base.buffer.length;
    base.subscribers.set(receiver, { startIndex: currentStartIndex, endIndex: Infinity });

    const subscription = createSubscription(
      () => {
        if (!unsubscribing) {
          unsubscribing = true;
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

          latestValue = result.value;
          receiver.next(result.value);
        }
      } catch (err: any) {
        receiver.error(err);
      } finally {
        receiver.complete();
        cleanupAfterReceiver(receiver);
      }
    })();

    Object.assign(subscription, {
      value: () => latestValue
    });

    return subscription;
  };

  const peek = (subscription?: Subscription): T | undefined => {
    if (subscription) {
      return subscription.value();
    }

    if (base.subscribers.size === 1) {
      const [subscriptionState] = base.subscribers.values();
      if (subscriptionState.startIndex < base.buffer.length) {
        return base.buffer[subscriptionState.startIndex];
      }
      return undefined;
    }

    console.warn("peek() without a subscription can only be used when there is exactly one subscriber.");
    return undefined;
  };

  const subject: Subject<T> = {
    type: "subject",
    name: "subject",
    peek,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(subject, ...steps),
    next,
    complete,
    completed: () => base.completed,
    error,
  };

  return subject;
}
