import { createReceiver, createSubscription, Operator, pipeStream, Receiver, StreamMapper, Subscription } from "../abstractions";
import { createBaseSubject, Subject } from "../streams";

export type BehaviorSubject<T> = Subject<T>;

export function createBehaviorSubject<T>(initialValue: T): BehaviorSubject<T> {
  const { base, next, complete, error, pullValue, cleanupBuffer, cleanupAfterReceiver } = createBaseSubject<T>();

  base.buffer.push(initialValue);

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    base.subscribers.set(receiver, { startIndex: base.buffer.length - 1, endIndex: Infinity });

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

          subscription.latestValue = result.value;
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

  const subject: BehaviorSubject<T> = {
    type: "subject",
    name: "behaviorSubject",
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(subject, ...steps),
    next,
    complete,
    completed: () => base.completed,
    error,
  };

  return subject;
}
