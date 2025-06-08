import { createQueue, createReceiver, createSingleValueBuffer, createSubscription, Operator, pipeStream, Receiver, Stream, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export function createSubject<T = any>(): Subject<T> {
  // Create a single-value buffer (capacity=1)
  const buffer = createSingleValueBuffer<T>();
  const queue = createQueue();
  const subscribers = new Map<Receiver<T>, number>();
  let isCompleted = false;
  let hasError = false;

  const next = (value: T) => {
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

    const subscription = createSubscription(() => {
      if (!unsubscribing) {
        unsubscribing = true;
        queue.enqueue(async () => {
          subscription.unsubscribe();
          const readerId = subscribers.get(receiver);
          if (readerId !== undefined) {
            await buffer.detachReader(readerId);
          }
        });
      }
    });

    queue.enqueue(async () => {
      queueMicrotask(async () => {
        const readerId = await buffer.attachReader();
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
          subscribers.delete(receiver);
          receiver.complete();
        }
      });
    });

    Object.assign(subscription, {
      value: () => queue.enqueue(() => buffer.getValue())
    });

    return subscription;
  };

  const subject: Subject<T> & { getValue(): Promise<T | undefined>; } = {
    type: "subject",
    name: "subject",
    getValue: async () => {
      return queue.enqueue(() => buffer.getValue());
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
