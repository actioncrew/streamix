import { Buffer, createBuffer, createQueue, createReceiver, createReplayBuffer, createSubscription, Operator, pipeStream, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  peek(): Promise<T | undefined>;
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export function createBaseSubject<T = any>(capacity: number = 10, bufferType: "replay" | "standard" = "standard") {
  const buffer: Buffer<T> = bufferType === "standard" ? createBuffer<T>(capacity) : createReplayBuffer<T>(capacity);
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
    if (base.completed || base.hasError) return;
    queue.enqueue(() => buffer.write(value));
  };

  const complete = () => {
    if (base.completed) return;
    queue.enqueue(async () => {
      buffer.complete();

      setTimeout(() => {
        for (const receiver of base.subscribers.keys()) {
          receiver.complete?.();
        }

        base.subscribers.clear();
      }, 0);
    });
  };

  const error = (err: any) => {
    if (base.completed || base.hasError) return;
    queue.enqueue(async () => {
      base.hasError = true;
      base.errorValue = err;
      for (const receiver of base.subscribers.keys()) {
        receiver.error!(err);
      }
      base.subscribers.clear();
    });
  };

  const pullValue = async (readerId: number): Promise<IteratorResult<T, void>> => {

    try {
      const {value, done } = await base.buffer.read(readerId);
      return { value, done } as IteratorResult<T, void>;
    } catch (err) {
      return Promise.reject(err);
    }
  };


  const cleanupBuffer = () => {
    // Not needed with the new buffer, as it's automatically managing backpressure
  };

  const cleanupAfterReceiver = (receiver: Receiver<T>) => {
    const readerId = base.subscribers.get(receiver);
    if (readerId !== undefined) {
      base.subscribers.delete(receiver);
      // But defer buffer detach to allow current value to be processed
      Promise.resolve().then(() => {
        base.buffer.detachReader(readerId);
      });
    }
  };

  return {
    base,
    next,
    complete,
    error,
    pullValue,
    cleanupBuffer,
    cleanupAfterReceiver,
  };
}

export function createSubject<T = any>(): Subject<T> {
  const { base, next, complete, error, pullValue, cleanupAfterReceiver } = createBaseSubject<T>(10, "standard");

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;

    const subscription = createSubscription(
      () => {
        if (!unsubscribing) {
          unsubscribing = true;
          base.queue.enqueue(async () => {
            if (base.subscribers.size === 1) {
              complete();
            }

            cleanupAfterReceiver(receiver);
          });
        }
      }
    );

    base.queue.enqueue(async () => {
      const readerId = await base.buffer.attachReader();
      base.subscribers.set(receiver, readerId);

      queueMicrotask(async () => {
        try {
          while (true) {
            const result = await pullValue(readerId);
            if (result.done) break;
            receiver.next(result.value);
          }
        } catch (err: any) {
          receiver.error(err);
        } finally {
          receiver.complete();
          cleanupAfterReceiver(receiver);
        }
      })
    });

    Object.assign(subscription, {
      value: () => peek()
    });

    return subscription;
  };

  const peek = async (): Promise<T | undefined> => {
    return await base.queue.enqueue(async () => base.buffer.peek());
  };

  const subject: Subject<T> = {
    type: "subject",
    name: "subject",
    peek,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(subject, ...steps),
    next,
    complete,
    completed: () => base.completed,
    error,
  };

  return subject;
}
