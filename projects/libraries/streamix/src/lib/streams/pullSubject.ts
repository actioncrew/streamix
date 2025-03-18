import { createReceiver, createSubscription, Operator, pipeStream, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export function createSubject<T = any>(): Subject<T> {
  let buffer: T[] = []; // Shared buffer
  let subscribers = new Map<Receiver<T>, { startIndex: number; endIndex: number }>(); // Subscriber indices
  let completed = false;
  let hasError = false;
  let errorValue: any = null;

  // Pull request management
  const pullRequests = new Map<Receiver<T>, {
    resolve: (result: IteratorResult<T, void>) => void;
    reject: (error: any) => void;
  }>();

  const next = (value: T) => {
    if (completed || hasError) return;
    buffer.push(value);
    processPullRequests();
  };

  const complete = () => {
    if (completed) return;
    completed = true;
    processPullRequests();
  };

  const error = (err: any) => {
    if (completed || hasError) return;
    hasError = true;
    errorValue = err;
    for (const { reject } of pullRequests.values()) {
      reject(err);
    }
    pullRequests.clear();
  };

  const pullValue = (receiver: Receiver<T>): Promise<IteratorResult<T, void>> => {
    if (hasError) return Promise.reject(errorValue);

    const { startIndex, endIndex } = subscribers.get(receiver) ?? { startIndex: 0, endIndex: Infinity };
    if (startIndex >= endIndex) return Promise.resolve({ value: undefined, done: true });

    if (startIndex < buffer.length) {
      const value = buffer[startIndex];
      subscribers.set(receiver, { startIndex: startIndex + 1, endIndex });
      return Promise.resolve({ value, done: false });
    }

    if (completed) return Promise.resolve({ value: undefined, done: true });

    return new Promise<IteratorResult<T, void>>((resolve, reject) => {
      pullRequests.set(receiver, { resolve, reject });
    });
  };

  const processPullRequests = () => {
    for (const [receiver, request] of pullRequests.entries()) {
      if (receiver.unsubscribed) {
        pullRequests.delete(receiver);
        continue;
      }
      pullValue(receiver).then(request.resolve).catch(request.reject);
      pullRequests.delete(receiver);
    }
  };

  const cleanupBuffer = () => {
    // Find the lowest unread index among subscribers
    const minIndex = Math.min(...Array.from(subscribers.values(), ({ startIndex }) => startIndex ?? Infinity));
    if (minIndex > 0) {
      buffer.splice(0, minIndex); // Trim the buffer
      for (const receiver of subscribers.keys()) {
        const { startIndex, endIndex } = subscribers.get(receiver) ?? { startIndex: 0, endIndex: Infinity };
        subscribers.set(receiver, { startIndex: startIndex - minIndex, endIndex: endIndex - minIndex });
      }
    }
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const currentStartIndex = buffer.length; // Start from the current buffer index
    subscribers.set(receiver, { startIndex: currentStartIndex, endIndex: Infinity });

    const subscription = createSubscription(
      () => buffer[buffer.length - 1], // Provide the last emitted value
      () => {
        if(!receiver.unsubscribed) {
          receiver.unsubscribed = true;
          const subscriptionState = subscribers.get(receiver)!;
          subscriptionState.endIndex = buffer.length;
          subscribers.set(receiver, subscriptionState);
          pullRequests.delete(receiver); // Clear any pending pull requests
          cleanupBuffer();
        }
      }
    );

    (async () => {
      try {
        while (true) { // Control the loop via startIndex and endIndex
          const subscriptionState = subscribers.get(receiver);
          if (!subscriptionState || subscriptionState.startIndex >= subscriptionState.endIndex) {
            break; // Exit the loop if no more values can be processed
          }
          const result = await pullValue(receiver);
          if (result.done) break;
          receiver.next(result.value);
        }
      } catch (err: any) {
        receiver.error(err);
      } finally {
        receiver.complete();
        // Clean up once all values are processed or error occurs
        cleanupAfterReceiver(receiver);
      }
    })();

    return subscription;
  };

  const cleanupAfterReceiver = (receiver: Receiver<T>) => {
    // Remove the receiver from subscribers only when it has processed all values
    const subscriptionState = subscribers.get(receiver);
    if (subscriptionState && subscriptionState.startIndex >= subscriptionState.endIndex) {
      subscribers.delete(receiver);
      pullRequests.delete(receiver);
      cleanupBuffer(); // Clean up the buffer to avoid memory leaks
    }
  };

  const asyncIterator = async function* () {
    const receiver = createReceiver();
    // Assign the receiver to the subscribers map with the correct start index
    subscribers.set(receiver, { startIndex: buffer.length, endIndex: Infinity });

    try {
      while (true) {
        const subscriptionState = subscribers.get(receiver);
        if (!subscriptionState || subscriptionState.startIndex >= subscriptionState.endIndex) {
          // If the receiver has consumed all available values, break the loop
          break;
        }

        const result = await pullValue(receiver);
        if (result.done) {
          // If the stream has completed, finish the iteration
          break;
        }
        yield result.value;  // Yield the current value to the async iterator
      }
    } catch (err: any) {
      receiver.error(err);  // Handle any errors during the async iteration
    } finally {
      receiver.unsubscribed = true;  // Mark the receiver as unsubscribed
      cleanupAfterReceiver(receiver);  // Cleanup resources after processing
    }
  };

  const stream: Subject<T> = {
    type: "subject",
    name: "subject",
    [Symbol.asyncIterator]: asyncIterator,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(stream, ...steps),
    value: () => buffer[buffer.length - 1],
    next,
    complete,
    completed: () => completed,
    error,
  };

  return stream;
}
