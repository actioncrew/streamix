import {
  createReceiver,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  Subscription,
} from "../abstractions";
import { createBaseSubject, Subject } from "./subject";

export type ReplaySubject<T = any> = Omit<Subject<T>, "peek">;

export function createReplaySubject<T = any>(capacity: number = Infinity): ReplaySubject<T> {
  const { base, next, complete, error, pullValue } = createBaseSubject<T>(capacity, "replay");

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
      queueMicrotask(async () => {
        const readerId = await base.buffer.attachReader();
        try {
          base.subscribers.set(receiver, readerId);
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

  const replaySubject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    subscribe,
    pipe: function (this: ReplaySubject, ...steps: Operator[]) { return pipeStream(this, ...steps); },
    next,
    complete,
    completed: () => base.completed,
    error,
  };

  return replaySubject;
}
