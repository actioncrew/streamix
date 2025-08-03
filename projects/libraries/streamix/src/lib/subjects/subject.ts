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

/**
 * A `Subject` is a special type of `Stream` that can be manually pushed new values.
 * It acts as both a source of values and a consumer, multicasting to multiple subscribers.
 */
export type Subject<T = any> = Stream<T> & {
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
  get snappy(): T | undefined;
};

/**
 * Creates a new Subject instance.
 */
export function createSubject<T = any>(): Subject<T> {
  const buffer = createSingleValueBuffer<T>();
  const queue = createQueue();
  let latestValue: T | undefined = undefined;
  let isCompleted = false;
  let hasError = false;

  const next = (value: T) => {
    if (isCompleted || hasError) return;
    latestValue = value;
    queue.enqueue(async () => {
      await buffer.write(value);
    });
  };

  const complete = () => {
    if (isCompleted) return;
    isCompleted = true;
    queue.enqueue(async () => {
      await buffer.complete();
    });
  };

  const error = (err: any) => {
    if (isCompleted || hasError) return;
    hasError = true;
    isCompleted = true;
    queue.enqueue(async () => {
      await buffer.error(err);
      await buffer.complete();
    });
  };

  const subscribe = (
    callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>
  ): Subscription => {
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
        while (!unsubscribing) {
          const result = await buffer.read(readerId);
          if (result.done) break;
          await receiver.next?.(result.value);
        }
      } catch (err: any) {
        await receiver.error?.(err);
      } finally {
        if (!unsubscribing && readerId !== null) {
          await buffer.detachReader(readerId);
        }
        await receiver.complete?.();
      }
    });

    return subscription;
  };

  const subject: Subject<T> = {
    type: "subject",
    name: "subject",
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
