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
import { createQueue, createSubjectBuffer } from "../primitives";

/**
 * A `Subject` is a special type of `Stream` that can be manually pushed new values.
 * It acts as both a source of values and a consumer, multicasting to multiple subscribers.
 * Unlike a standard stream which is "cold" and begins from scratch for each subscriber,
 * a Subject is "hot" and broadcasts the same values to all of its subscribers.
 * @template T The type of the values held and emitted by the subject.
 * @extends {Stream<T>}
 */
export type Subject<T = any> = Stream<T> & {
  /**
   * Pushes the next value to all active subscribers.
   * @param {T} value The value to emit.
   * @returns {void}
   */
  next(value: T): void;
  /**
   * Signals that the subject has completed and will emit no more values.
   * This completion signal is sent to all subscribers.
   * @returns {void}
   */
  complete(): void;
  /**
   * Signals that the subject has terminated with an error.
   * The error is sent to all subscribers, and the subject is marked as completed.
   * @param {any} err The error to emit.
   * @returns {void}
   */
  error(err: any): void;
  /**
   * Checks if the subject has been completed.
   * @returns {boolean} `true` if the subject has completed, `false` otherwise.
   */
  completed(): boolean;
  /**
   * Provides synchronous access to the most recently pushed value.
   * @type {T | undefined}
   */
  get snappy(): T | undefined;
};

/**
 * Creates a new Subject instance.
 *
 * A Subject can be used to manually control a stream, emitting values
 * to all active subscribers. It is a fundamental building block for
 * reactive patterns like event bus systems or shared state management.
 *
 * @template T The type of the values that the subject will emit.
 * @returns {Subject<T>} A new Subject instance.
 */
export function createSubject<T = any>(context?: PipelineContext): Subject<T> {
  const buffer = createSubjectBuffer<{ value: T, phantom?: boolean }>();
  const queue = createQueue();
  let latestValue: T | undefined = undefined;
  let isCompleted = false;
  let hasError = false;

  const next = function (value: T) {
    latestValue = value;
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
      await buffer.write({ value });
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
          const { value: result, done } = await buffer.read(readerId);
          if (done) break;

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

  const subject: Subject<T> = {
    type: "subject",
    name: "subject",
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
