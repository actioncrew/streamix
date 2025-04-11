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

export function createReplaySubject<T = any>(capacity: number = Infinity): Subject<T> {
  const { base, next, complete, error, pullValue, cleanupAfterReceiver } = createBaseSubject<T>(capacity, "replay");

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;

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
      value: () => peek()
    });

    return subscription;
  };

  const peek = async (): Promise<T | undefined> => {
    return await base.queue.enqueue(async () => base.buffer.peek());
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
