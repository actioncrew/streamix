import {
  CallbackReturnType,
  createReceiver,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  scheduler,
  Stream,
  Subscription,
} from "../abstractions";
import { firstValueFrom } from "../converters";
import { createReplayBuffer, ReplayBuffer } from "../primitives";
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
 * This subject provides asynchronous delivery and scheduling via a global scheduler.
 *
 * @template T The type of the values the subject will emit.
 * @param {number} [capacity=Infinity] The maximum number of past values to buffer and replay to new subscribers.
 * @returns {ReplaySubject<T>} A new ReplaySubject instance.
 */
export function createReplaySubject<T = any>(capacity: number = Infinity): ReplaySubject<T> {
  const buffer = createReplayBuffer<T>(capacity) as ReplayBuffer;
  let isCompleted = false;
  let hasError = false;
  let latestValue: T | undefined = undefined;

  const next = (value: T) => {
    latestValue = value;
    scheduler.enqueue(async () => {
      if (isCompleted || hasError) return;
      await buffer.write(value);
    });
  };

  const complete = () => {
    scheduler.enqueue(async () => {
      if (isCompleted) return;
      isCompleted = true;
      await buffer.complete();
    });
  };

  const error = (err: any) => {
    scheduler.enqueue(async () => {
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
    let readerLatestValue: T | undefined;

    const subscription = createSubscription(() => {
      if (!unsubscribing) {
        unsubscribing = true;
        scheduler.enqueue(async () => {
          if (readerId !== null) {
            await buffer.detachReader(readerId);
          }
        });
      }
    });

    scheduler.enqueue(() => buffer.attachReader()).then(async (id: number) => {
      readerId = id;
      try {
        while (true) {
          const result = await buffer.read(readerId);
          if (result.done) break;
          readerLatestValue = result.value;
          await receiver.next(readerLatestValue!);
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
      value: () => readerLatestValue
    });

    return subscription;
  };

  const replaySubject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    pipe(...operators: Operator<any, any>[]): Stream<any> {
      return pipeStream(this, operators);
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