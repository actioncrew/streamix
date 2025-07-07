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
  let isCompleted = false;
  let hasError = false;

  const next = (value: T) => {
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
      await buffer.write(value === undefined ? null as T : value);
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
      hasError = true;
      isCompleted = true;
      await buffer.error(err);
      await buffer.complete();
    });
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    let readerId: number | null = null;

    const subscription = createSubscription(() => {
      if (!unsubscribing) {
        unsubscribing = true;
        queue.enqueue(async () => {
          if (readerId !== null) {
            await buffer.detachReader(readerId);
          }
        });
      }
    });

    queue.enqueue(() => buffer.attachReader()).then(async (id: number) => {
      readerId = id;
      try {
        while (true) {
          const result = await buffer.read(readerId);
          if (result.done) break;
          receiver.next(result.value);
        }
      } catch (err: any) {
        receiver.error(err);
      } finally {
        if (!unsubscribing && readerId !== null) {
          await buffer.detachReader(readerId);
        }
        receiver.complete();
      }
    });

    Object.assign(subscription, {
      value: () => {
        throw new Error("Replay subject does not support single value property");
      }
    });

    return subscription;
  };

  const replaySubject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    subscribe,
    pipe(...steps: Operator[]) {
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
