import {
  CallbackReturnType,
  createReceiver,
  createSubscription,
  Operator,
  PipelineContext,
  pipeStream,
  Receiver,
  Stream,
  Subscription
} from "../abstractions";
import { firstValueFrom } from "../converters";
import { createBehaviorSubjectBuffer, createQueue } from "../primitives";
import { Subject } from "./subject";

/**
 * A BehaviorSubject is a special type of Subject that maintains
 * a current value and emits that value immediately to new subscribers.
 * It allows synchronous retrieval of the latest emitted value via `.snappy`.
 *
 * It is "stateful" in that it remembers the last value it emitted.
 *
 * @template T The type of the values held and emitted by the subject.
 * @extends {Subject<T>}
 */
export type BehaviorSubject<T = any> = Subject<T> & {
  /**
   * Provides synchronous access to the most recently pushed value.
   * This value is the last value passed to the `next()` method, or the initial value if none have been emitted.
   *
   * @type {T}
   */
  get snappy(): T;
};

/**
 * Creates a BehaviorSubject that holds a current value and emits it immediately to new subscribers.
 * It maintains the latest value internally and allows synchronous access via the `snappy` getter.
 *
 * The subject queues emitted values and delivers them to subscribers asynchronously,
 * supporting safe concurrent access and orderly processing.
 *
 * @template T The type of the values the subject will hold.
 * @param {T} initialValue The value that the subject will hold upon creation.
 * @returns {BehaviorSubject<T>} A new BehaviorSubject instance.
 */
export function createBehaviorSubject<T = any>(initialValue: T, context?: PipelineContext): BehaviorSubject<T> {
  const buffer = createBehaviorSubjectBuffer<T>(initialValue);
  const queue = createQueue();
  let latestValue = initialValue;
  let isCompleted = false;
  let hasError = false;

  const next = function (value: T) {
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
          const { value, done } = await buffer.read(readerId);
          if (done) break;

          await receiver.next(value);
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
    pipe(...operators: Operator<any, any>[]): Stream<any> {
      return pipeStream(this, operators, context);
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
