import {
  CallbackReturnType,
  createReceiver,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  Stream,
  Subscription
} from "../abstractions";
import { firstValueFrom } from "../converters";
import { createQueue, createSingleValueBuffer } from "../primitives";
import { Subject } from "./subject";

/**
 * A BehaviorSubject is a special type of Subject that maintains
 * a current value and emits that value immediately to new subscribers.
 * It allows synchronous retrieval of the latest emitted value via `.snappy`.
 */
export type BehaviorSubject<T = any> = Subject<T> & {
  get snappy(): T;
};

/**
 * Creates a BehaviorSubject that holds a current value and emits it immediately to new subscribers.
 * It maintains the latest value internally and allows synchronous access via the `snappy` getter.
 *
 * The subject queues emitted values and delivers them to subscribers asynchronously,
 * supporting safe concurrent access and orderly processing.
 */
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
          await receiver.next(result.value);
        }
      } catch (err: any) {
        await receiver.error(err);
      } finally {
        if (!unsubscribing && readerId !== null) {
          await buffer.detachReader(readerId);
        }
        await receiver.complete();
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
    get snappy() {
      return latestValue;
    },
    pipe<O extends readonly [Operator<any, any>, ...Operator<any, any>[]]>(...operators: O): Stream<any> {
      return pipeStream(this, ...operators);
    },
    subscribe,
    async query(): Promise<T> {
      return await firstValueFrom(this);
    },
    next,
    complete,
    completed: () => isCompleted,
    error,
  };

  return subject;
}
