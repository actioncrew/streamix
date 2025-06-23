import {
  createQueue,
  createReceiver,
  createReplayBuffer,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  ReplayBuffer,
  Subscription,
} from "../abstractions";
import { Subject } from "./subject";

export type ReplaySubject<T = any> = Subject<T>;

export function createReplaySubject<T = any>(capacity: number = Infinity): ReplaySubject<T> {
  const buffer = createReplayBuffer<T>(capacity) as ReplayBuffer;
  const queue = createQueue();
  const subscribers = new Map<Receiver<T>, number>();
  let isCompleted = false;
  let hasError = false;

  const next = (value: T) => {
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
      if (value === undefined) value = null as T;
      await buffer.write(value);
    });
  };

  const complete = () => {
    queue.enqueue(async () => {
      if (isCompleted) return;
      isCompleted = true;
      await buffer.complete();
    });
  };

  const error = (err: any) => {
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
      hasError = true; isCompleted = true;
      await buffer.error(err);
      await buffer.complete();
    });
  };

  const pullValue = async (readerId: number): Promise<IteratorResult<T, void>> => {
    if (hasError) return { value: undefined, done: true };

    try {
      const result = await buffer.read(readerId);
      return result as IteratorResult<T, void>;
    } catch (err) {
      return Promise.reject(err);
    }
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;

    const subscription = createSubscription(() => {
      if (!unsubscribing) {
        unsubscribing = true;
        queue.enqueue(async () => {
          const readerId = subscribers.get(receiver);
          if (readerId !== undefined) {
            await buffer.detachReader(readerId);
          }
        });
      }
    });

    queue.enqueue(async () => {
      queueMicrotask(async () => {
        const readerId = await buffer.attachReader();
        try {
          subscribers.set(receiver, readerId);
          while (true) {
            const result = await pullValue(readerId);
            if (result.done) break;
            receiver.next(result.value);
          }
        } catch (err: any) {
          receiver.error?.(err);
        } finally {
          if (!unsubscribing) { await buffer.detachReader(readerId); }
          receiver.complete();
          subscribers.delete(receiver);
        }
      });
    });

    Object.assign(subscription, {
      value: () => { throw new Error("Replay subject does not support single value property"); }
    });

    return subscription;
  };

  const replaySubject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    subscribe,
    pipe: function (this: ReplaySubject, ...steps: Operator[]) {
      return pipeStream(this, ...steps);
    },
    get value(): undefined {
      throw new Error("Replay subject does not support single value property");
    },
    next,
    complete,
    completed: () => isCompleted,
    error,
  };

  return replaySubject;
}
