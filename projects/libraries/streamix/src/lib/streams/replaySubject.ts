import {
  createReceiver,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  StreamMapper,
  Subscription,
} from "../abstractions";
import { createBaseSubject, Subject } from "./subject";

export type ReplaySubject<T = any> = Subject<T>;

export function createReplaySubject<T = any>(capacity: number = 10): Subject<T> {
  const { base, next, complete, error, pullValue, cleanupAfterReceiver } = createBaseSubject<T>(capacity, "replay");

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    let latestValue: T | undefined;

    const subscription = createSubscription(
      () => {
        if (!unsubscribing) {
          unsubscribing = true;
          base.queue.enqueue(async () => {
            if (base.subscribers.size === 1) {
              complete();
            }

            cleanupAfterReceiver(receiver);
          });
        }
      }
    );

    base.queue.enqueue(async () => {
      const readerId = await base.buffer.attachReader();
      base.subscribers.set(receiver, readerId);

      queueMicrotask(async () => {
        try {
          while (true) {
            const result = await pullValue(readerId);
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
      })
    });

    Object.assign(subscription, {
      value: () => latestValue
    });

    return subscription;
  };

  const peek = (subscription?: Subscription): T | undefined => {
    if (subscription) {
      return subscription.value();
    }

    // if (base.subscribers.size === 1) {
    //   const [subscriptionState] = base.subscribers.values();
    //   if (subscriptionState < base.buffer.writeIndex) {
    //     return base.buffer.read(subscriptionState);
    //   }
    //   return undefined;
    // }

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
