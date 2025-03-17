import { createReceiver, createSubscription, Operator, pipeStream, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export type PullSubscription<T> = Subscription & {
  pull(): Promise<IteratorResult<T, void>>;
};

// Pull-based Subject Implementation
// Pull-based Subject Implementation
export function createSubject<T = any>(): Subject<T> {
  let subscribers: Receiver<T>[] = [];
  let valueQueue: T[] = []; // Queue to store values until requested
  let currentValue: T | undefined;
  let completed = false;
  let hasError = false;
  let errorValue: any = null;

  // Map to track pull requests from subscribers
  const pullRequests = new Map<Receiver<T>, {
    resolve: (result: IteratorResult<T, void>) => void;
    reject: (error: any) => void;
  }>();

  // Add a value to the queue
  const next = (value: T) => {
    if (completed || hasError) return;
    currentValue = value;
    valueQueue.push(value);

    // Resolve any pending pull requests
    processPullRequests();
  };

  // Complete the stream
  const complete = () => {
    if (completed) return;
    completed = true;

    // Resolve any pending pull requests with completed status
    processPullRequests();
  };

  // Emit an error
  const error = (err: any) => {
    if (completed || hasError) return;
    hasError = true;
    errorValue = err;

    // Reject any pending pull requests with the error
    for (const [, { reject }] of pullRequests.entries()) {
      reject(err);
    }
    pullRequests.clear();
  };

  // Process any pending pull requests
  const processPullRequests = () => {
    const entries = [...pullRequests.entries()];

    for (const [receiver, { resolve }] of entries) {
      if (receiver.unsubscribed) {
        pullRequests.delete(receiver);
        continue;
      }

      if (valueQueue.length > 0) {
        const value = valueQueue.shift()!;
        resolve({ value, done: false });
        pullRequests.delete(receiver);
      } else if (completed) {
        resolve({ value: undefined, done: true });
        pullRequests.delete(receiver);
      }
    }
  };

  // Function to pull a value for a specific receiver
  const pullValue = (receiver: Receiver<T>): Promise<IteratorResult<T, void>> => {
    if (receiver.unsubscribed) {
      return Promise.reject(new Error("Subscription has been unsubscribed"));
    }

    if (hasError) {
      return Promise.reject(errorValue);
    }

    if (valueQueue.length > 0) {
      const value = valueQueue.shift()!;
      return Promise.resolve({ value, done: false });
    }

    if (completed) {
      return Promise.resolve({ value: undefined, done: true });
    }

    return new Promise<IteratorResult<T, void>>((resolve, reject) => {
      pullRequests.set(receiver, { resolve, reject });
    });
  };

  // Enhanced subscribe with pull capability
  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): PullSubscription<T> => {
    const receiver = createReceiver(callbackOrReceiver);
    subscribers.push(receiver);

    // Create a base subscription
    const baseSubscription = createSubscription(
      // getValue function
      () => currentValue,
      // unsubscribe function
      () => {
        if (!receiver.unsubscribed) {
          receiver.unsubscribed = true;

          if (pullRequests.has(receiver)) {
            const { resolve } = pullRequests.get(receiver)!;
            resolve({ value: undefined, done: true });
            pullRequests.delete(receiver);
          }

          subscribers = subscribers.filter(sub => sub !== receiver);
        }
      }
    );

    // Create a pull method
    const pull = () => pullValue(receiver);

    // Attach the pull method to the subscription
    return Object.assign(baseSubscription, { pull }) as PullSubscription<T>;
  };

  // AsyncIterator implementation using pull mechanism
  const asyncIterator = async function* (this: Subject<T>): AsyncGenerator<T, void, unknown> {
    const subscription = this.subscribe() as PullSubscription<T>;

    try {
      while (true) {
        const result = await subscription.pull();
        if (result.done) break;
        yield result.value;
      }
    } finally {
      subscription.unsubscribe();
    }
  };

  const stream: Subject<T> = {
    type: "subject",
    name: "subject",
    [Symbol.asyncIterator]: asyncIterator,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(stream, ...steps),
    value: () => currentValue,
    next,
    complete,
    completed: () => completed,
    error,
  };

  return stream;
}
