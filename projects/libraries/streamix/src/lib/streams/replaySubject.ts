import { createReceiver, createSubscription, Operator, pipeStream, Receiver, StreamMapper, Subscription } from "../abstractions";
import { createBaseSubject, Subject } from "../streams";

export type ReplaySubject<T = any> = Subject<T>;

export function createReplaySubject<T>(bufferSize: number = Infinity): ReplaySubject<T> {
  // Create the base subject internals
  const base = createBaseSubject<T>();

  const next = (value: T) => {
    if (base.completed || base.hasError) return;
    base.buffer.push(value);

    // Maintain buffer size
    if (bufferSize !== Infinity && base.buffer.length > bufferSize) {
      base.buffer.shift();

      // Adjust subscriber indices when removing items from buffer
      for (const [receiver, state] of base.subscribers.entries()) {
        if (state.startIndex > 0) {
          base.subscribers.set(receiver, {
            startIndex: state.startIndex - 1,
            endIndex: state.endIndex === Infinity ? Infinity : state.endIndex - 1
          });
        }
      }
    }

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

  // Modified subscribe method to replay buffered values
  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);

    // For ReplaySubject, determine how many values to replay
    const replayCount = Math.min(bufferSize, base.buffer.length);
    const replayStartIndex = base.buffer.length - replayCount;

    // Set the starting index to replay the appropriate number of values
    base.subscribers.set(receiver, { startIndex: replayStartIndex, endIndex: Infinity });

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

    // Replay buffered values immediately
    for (let i = replayStartIndex; i < base.buffer.length; i++) {
      receiver.next(base.buffer[i]);
    }

    // Update start index to avoid replaying values again in the async loop
    base.subscribers.set(receiver, { startIndex: base.buffer.length, endIndex: Infinity });

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

  // Buffer cleanup with consideration for buffer size
  const cleanupBuffer = () => {
    // Find the minimum index that's still needed
    const minIndex = Math.min(
      ...Array.from(base.subscribers.values(), ({ startIndex }) => startIndex ?? Infinity)
    );

    // Calculate how many items we can remove while respecting bufferSize
    const itemsToKeep = Math.max(base.buffer.length - minIndex, bufferSize);
    const itemsToRemove = base.buffer.length - itemsToKeep;

    if (itemsToRemove > 0) {
      base.buffer.splice(0, itemsToRemove);
      for (const receiver of base.subscribers.keys()) {
        const { startIndex, endIndex } = base.subscribers.get(receiver) ?? { startIndex: 0, endIndex: Infinity };
        base.subscribers.set(receiver, {
          startIndex: Math.max(0, startIndex - itemsToRemove),
          endIndex: endIndex === Infinity ? Infinity : endIndex - itemsToRemove
        });
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

  // Modified async iterator to replay buffered values
  const asyncIterator = async function* () {
    const receiver = createReceiver();

    // For ReplaySubject, determine how many values to replay
    const replayCount = Math.min(bufferSize, base.buffer.length);
    const replayStartIndex = base.buffer.length - replayCount;

    // Set the starting index to replay the appropriate number of values
    base.subscribers.set(receiver, { startIndex: replayStartIndex, endIndex: Infinity });

    try {
      // First yield the replayed values
      for (let i = replayStartIndex; i < base.buffer.length; i++) {
        yield base.buffer[i];
      }

      // Update start index to avoid replaying values again
      base.subscribers.set(receiver, { startIndex: base.buffer.length, endIndex: Infinity });

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

  // Return the stream with public API and exposed private methods prefixed with _
  const replaySubject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    [Symbol.asyncIterator]: asyncIterator,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(replaySubject, ...steps),
    value: () => base.buffer[base.buffer.length - 1],
    next,
    complete,
    completed: () => base.completed,
    error
  };

  return replaySubject;
}
