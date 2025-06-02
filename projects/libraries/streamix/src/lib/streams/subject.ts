import { createQueue, createReceiver, createReplayBuffer, createSingleValueBuffer, createSubscription, CyclicBuffer, Operator, pipeStream, Receiver, Stream, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export function createBaseSubject<T = any>(capacity: number = 10, bufferType: "replay" | "standard" = "standard") {
  const buffer: CyclicBuffer<T> = bufferType === "standard" ? createSingleValueBuffer<T>() : createReplayBuffer<T>(capacity);
  const queue = createQueue()

  const base = {
    queue,
    buffer: buffer,
    subscribers: new Map<Receiver<T>, number>(), // Maps receiver to its readerId
    completed: false,
    hasError: false,
    errorValue: null as any,
  };

  const next = (value: T) => {
    queue.enqueue(async () => {
      if (base.completed || base.hasError) return;
      if (value === undefined) { value = null as T; }
      await buffer.write(value);
    });
  };

  const complete = () => {
    queue.enqueue(async () => {
      if (base.completed) return;
      base.completed = true;
      await buffer.complete();

      setTimeout(() => {
        for (const receiver of base.subscribers.keys()) {
          receiver.complete?.();
        }

        base.subscribers.clear();
      }, 0);
    });
  };

  const error = (err: any) => {
    queue.enqueue(async () => {
      if (base.completed || base.hasError) return;
      base.hasError = true;
      base.errorValue = err;
      for (const receiver of base.subscribers.keys()) {
        receiver.error!(err);
      }
      base.subscribers.clear();
    });
  };

  const pullValue = async (readerId: number): Promise<IteratorResult<T, void>> => {
    if (base.hasError) return { value: undefined, done: true };

    try {
      const result = await base.buffer.read(readerId);
      return result as IteratorResult<T, void>;
    } catch (err) {
      return Promise.reject(err);
    }
  };


  const cleanupBuffer = () => {
    // Not needed with the new buffer, as it's automatically managing backpressure
  };

  return {
    base,
    next,
    complete,
    error,
    pullValue,
    cleanupBuffer
  };
}

export function createSubject<T = any>(): Subject<T> {
  // Create a single-value buffer (capacity=1)
  const buffer = createSingleValueBuffer<T>();
  const queue = createQueue();
  const subscribers = new Map<Receiver<T>, number>(); // Maps receiver to its readerId
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

      setTimeout(() => {
        for (const receiver of subscribers.keys()) {
          receiver.complete?.();
        }
        subscribers.clear();
      }, 0);
    });
  };

  const error = (err: any) => {
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
      hasError = true;
      for (const receiver of subscribers.keys()) {
        receiver.error!(err);
      }
      subscribers.clear();
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
            subscription.unsubscribe();
            if (subscribers.size === 1) {
              complete();
            }

            const readerId = subscribers.get(receiver);
            if (readerId !== undefined) {
              subscribers.delete(receiver);
              await buffer.detachReader(readerId);
            }
          });
        }
      }
    );

    queue.enqueue(async () => {
      queueMicrotask(async () => {
        const readerId = await buffer.attachReader();
        try {
          subscribers.set(receiver, readerId);
          while (true) {
            const result = await pullValue(readerId);
            if (result.done) break;
            receiver.next(result.value);
          }
        } catch (err: any) {
          receiver.error(err);
        } finally {
          subscribers.delete(receiver);
          await buffer.detachReader(readerId);
          receiver.complete();
        }
      });
    });

    return subscription;
  };

  const subject: Subject<T> & { get value(): T | undefined; } = {
    type: "subject",
    name: "subject",
    get value() {
      return buffer.value;
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
