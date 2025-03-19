import { createReceiver, createSubscription, Operator, pipeStream, Receiver, StreamMapper, Subscription } from "../abstractions";
import { createBaseSubject, Subject } from "../streams";

export type BehaviorSubject<T> = Subject<T> & {
  getValue(): T;
};

export function createBehaviorSubject<T>(initialValue: T): BehaviorSubject<T> {
  const { base, next, complete, error, pullValue, cleanupBuffer, cleanupAfterReceiver } = createBaseSubject<T>();

  base.buffer.push(initialValue);

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    base.subscribers.set(receiver, { startIndex: base.buffer.length - 1, endIndex: Infinity });

    const subscription = createSubscription(
      () => base.buffer[base.buffer.length - 1],
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

    base.subscribers.set(receiver, { startIndex: base.buffer.length - 1, endIndex: Infinity });

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

  const getValue = () => base.buffer[base.buffer.length - 1];

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
