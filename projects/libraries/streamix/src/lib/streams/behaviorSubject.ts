import {
  createReceiver,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  Subscription
} from "../abstractions";
import { createBaseSubject, Subject } from "./subject"; // Adjust path as needed

export type BehaviorSubject<T = any> = Subject<T>;

export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  const {
    base,
    next,
    complete,
    error,
    pullValue,
  } = createBaseSubject<T>();

  const peek = async (): Promise<T | undefined> => {
    return await base.queue.enqueue(async () => base.buffer.peek());
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;

    const subscription = createSubscription(
      () => {
        if (!unsubscribing) {
          unsubscribing = true;
          base.queue.enqueue(async () => {
            subscription.unsubscribe();
            if (base.subscribers.size === 1) {
              complete();
            }

            const readerId = base.subscribers.get(receiver);
            if (readerId !== undefined) {
              base.subscribers.delete(receiver);
              await base.buffer.detachReader(readerId);
            }
          });
        }
      }
    );

    base.queue.enqueue(async () => {
      const readerId = await base.buffer.attachReader();
      base.subscribers.set(receiver, readerId);

      await base.buffer.write(initialValue);

      queueMicrotask(async () => {
        try {
          while (true) {
            const result = await pullValue(readerId);
            if (result.done) break;
            receiver.next(result.value);
          }
        } catch (err: any) {
          receiver.error(err);
        } finally {
          base.subscribers.delete(receiver);
          await base.buffer.detachReader(readerId);
          receiver.complete();
        }
      });
    });

    Object.assign(subscription, {
      value: () => peek()
    });

    return subscription;
  };

  const behaviorSubject: BehaviorSubject<T> = {
    type: "subject",
    name: "behaviorSubject",
    peek,
    subscribe,
    pipe: (...steps: Operator[]) => pipeStream(behaviorSubject, ...steps),
    next,
    complete,
    completed: () => base.completed,
    error,
  };

  return behaviorSubject;
}
