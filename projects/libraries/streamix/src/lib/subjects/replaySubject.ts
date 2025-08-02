import {
  CallbackReturnType,
  createReceiver,
  createSubscription,
  GetChainOutput,
  Operator,
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
 */
export type ReplaySubject<T = any> = Subject<T>;

/**
 * Creates a new ReplaySubject.
 *
 * A ReplaySubject is a variant of a Subject that stores a specified number of
 * the latest values it has emitted and "replays" them to any new subscribers.
 * This allows late subscribers to receive past values they may have missed.
 */
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
          const result = await buffer.read(readerId);
          if (result.done) break;
          latestValue = result.value;
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
    pipe<Chain extends Operator<any, any>[]>(
      ...steps: Chain
    ): Stream<GetChainOutput<T, Chain>> {
      return pipeStream(this, ...steps);
    },
    subscribe,
    async query(): Promise<T> {
      return await firstValueFrom(this);
    },
    get snappy(): undefined {
      throw new Error("Replay subject does not support snappy.");
    },
    next,
    complete,
    completed: () => isCompleted,
    error,
  };

  return replaySubject;
}
