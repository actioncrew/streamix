import {
  CallbackReturnType,
  createReceiver,
  createSubscription,
  Operator,
  PipelineContext,
  pipeStream,
  Receiver,
  Stream,
  Subscription,
} from "../abstractions";
import { firstValueFrom } from "../converters";
import { createQueue, createReplayBuffer, ReplayBuffer } from "../primitives";
import { Subject } from "./subject";

/**
 * A type alias for a ReplaySubject, which is a type of Subject.
 *
 * A ReplaySubject stores a specified number of the latest values it has emitted
 * and "replays" them to any new subscribers. This allows late subscribers to
 * receive past values they may have missed.
 *
 * @template T The type of the values emitted by the subject.
 * @extends {Subject<T>}
 */
export type ReplaySubject<T = any> = Subject<T>;

/**
 * Creates a new ReplaySubject.
 *
 * A ReplaySubject is a variant of a Subject that stores a specified number of
 * the latest values it has emitted and "replays" them to any new subscribers.
 * This allows late subscribers to receive past values they may have missed.
 *
 * This subject does not provide synchronous access to its value, and will
 * throw an error if the `snappy` getter is used.
 *
 * @template T The type of the values the subject will emit.
 * @param {number} [capacity=Infinity] The maximum number of past values to buffer and replay to new subscribers. Use `Infinity` for an unbounded buffer.
 * @returns {ReplaySubject<T>} A new ReplaySubject instance.
 */
export function createReplaySubject<T = any>(capacity: number = Infinity, context?: PipelineContext): ReplaySubject<T> {
  const buffer = createReplayBuffer<T>(capacity) as ReplayBuffer;
  const queue = createQueue();
  let isCompleted = false;
  let hasError = false;
  let latestValue: T | undefined = undefined;

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
    let latestValue: T | undefined;

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

          latestValue = value;
          await receiver.next(latestValue!);
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
      value: () => {
        return latestValue;
      }
    });

    return subscription;
  };

  const replaySubject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    pipe(...operators: Operator<any, any>[]): Stream<any> {
      return pipeStream(this, operators, context);
    },
    subscribe,
    async query(): Promise<T> {
      return await firstValueFrom(this);
    },
    get snappy(): T | undefined {
      return latestValue;
    },
    next,
    complete,
    completed: () => isCompleted,
    error,
  };

  return replaySubject;
}
