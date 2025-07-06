import { createQueue, createReceiver, createSingleValueBuffer, createSubscription, Operator, pipeStream, Receiver, Subscription } from "../abstractions";
import { Subject } from "./subject"; // Adjust path as needed

export type BehaviorSubject<T = any> = Subject<T> & {
  get value(): T;
};

export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  // Create a single-value buffer (capacity=1)
  const buffer = createSingleValueBuffer<T>(initialValue);
  const queue = createQueue();
  const subscribers = new Map<Receiver<T>, number>(); // Maps receiver to its readerId
  let latestValue = initialValue;
  let isCompleted = false;
  let hasError = false;

  const next = (value: T) => {
    latestValue = value;
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
      if (value === undefined) { value = null as T; }
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

    const subscription = createSubscription(
      () => {
        if (!unsubscribing) {
          unsubscribing = true;
          queue.enqueue(async () => {
            const readerId = subscribers.get(receiver);
            if (readerId !== undefined) {
              await buffer.detachReader(readerId);
            }
          });
        }
      }
    );

    queue.enqueue(async () => {
      return await buffer.attachReader();
    }).then((readerId) => {
      subscribers.set(receiver, readerId);
      try {
        while (true) {
          const result = await pullValue(readerId);
          if (result.done) break;
          receiver.next(result.value);
        }
      } catch (err: any) {
        receiver.error(err);
      } finally {
        if (!unsubscribing) { await buffer.detachReader(readerId); }
        receiver.complete();
        subscribers.delete(receiver);
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
    get value(): T {
      return latestValue;
    },
    subscribe,
    pipe: function (this: Subject, ...steps: Operator[]) {
      return pipeStream(this, ...steps);
    },
    next,
    complete,
    completed: () => isCompleted,
    error,
  };

  return subject;
}
