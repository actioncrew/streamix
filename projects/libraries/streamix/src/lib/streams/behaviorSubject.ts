import {
  CallbackReturnType,
  createQueue,
  createReceiver,
  createSingleValueBuffer,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  Subscription
} from "../abstractions";
import { Subject } from "./subject";

export type BehaviorSubject<T = any> = Subject<T> & {
  get value(): T;
};

export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  const buffer = createSingleValueBuffer<T>(initialValue);
  const queue = createQueue();
  let latestValue = initialValue;
  let isCompleted = false;
  let hasError = false;

  const next = (value: T) => {
    latestValue = value;
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
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
      hasError = true;
      isCompleted = true;
      await buffer.error(err);
      await buffer.complete();
    });
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>): Subscription => {
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
      value: () => latestValue
    });

    return subscription;
  };

  const subject: BehaviorSubject<T> = {
    type: "subject",
    name: "behaviorSubject",
    get value() {
      return latestValue;
    },
    subscribe,
    pipe(...steps: Operator[]) {
      return pipeStream(this, ...steps);
    },
    next,
    complete,
    completed: () => isCompleted,
    error,
  };

  return subject;
}
