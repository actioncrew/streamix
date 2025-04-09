import {
  Buffer,
  createBuffer,
  createQueue,
  createReceiver,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  Stream,
  StreamMapper,
  Subscription
} from "../abstractions";

export type BehaviorSubject<T = any> = Stream<T> & {
  peek(subscription?: Subscription): T | undefined;
  next(value: T): void;
  complete(): void;
  error(err: any): void;
  completed(): boolean;
};

export function createBehaviorSubject<T = any>(initialValue: T): BehaviorSubject<T> {
  const capacity = 10;
  const buffer: Buffer<T> = createBuffer<T>(capacity);
  const queue = createQueue();

  const base = {
    queue,
    buffer,
    subscribers: new Map<Receiver<T>, number>(),
    completed: false,
    hasError: false,
    errorValue: null as any,
    current: initialValue,
    hasCurrent: true,
  };

  const next = (value: T) => {
    if (base.completed || base.hasError) return;
    base.current = value;
    base.hasCurrent = true;
    queue.enqueue(() => buffer.write(value));
  };

  const complete = () => {
    if (base.completed) return;
    base.completed = true;
    queue.enqueue(async () => {
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
    if (base.completed || base.hasError) return;
    base.hasError = true;
    base.errorValue = err;
    for (const receiver of base.subscribers.keys()) {
      receiver.error?.(err);
    }
    base.subscribers.clear();
  };

  const pullValue = async (readerId: number): Promise<IteratorResult<T, void>> => {
    if (base.hasError) return Promise.reject(base.errorValue);
    try {
      const { value, done } = await buffer.read(readerId);
      return { value, done } as IteratorResult<T, void>;
    } catch (err) {
      return Promise.reject(err);
    }
  };

  const cleanupAfterReceiver = (receiver: Receiver<T>) => {
    const readerId = base.subscribers.get(receiver);
    if (readerId !== undefined) {
      base.subscribers.delete(receiver);
      Promise.resolve().then(() => {
        buffer.detachReader(readerId);
      });
    }
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    let latestValue: T | undefined = base.current;

    const subscription = createSubscription(
      () => {
        if (!unsubscribing) {
          unsubscribing = true;
          base.queue.enqueue(async () => {
            cleanupAfterReceiver(receiver);
          });
        }
      }
    );

    base.queue.enqueue(async () => {
      const readerId = await buffer.attachReader();
      base.subscribers.set(receiver, readerId);

      buffer.write(initialValue);

      queueMicrotask(async () => {
        try {
          while (true) {
            const result = await pullValue(readerId);
            if (result.done) break;
            latestValue = result.value;
            receiver.next?.(result.value);
          }
        } catch (err: any) {
          receiver.error?.(err);
        } finally {
          receiver.complete?.();
          cleanupAfterReceiver(receiver);
        }
      });
    });

    Object.assign(subscription, {
      value: () => latestValue
    });

    return subscription;
  };

  const peek = (subscription?: Subscription): T | undefined => {
    if (subscription?.value) {
      return subscription.value();
    }
    return base.current;
  };

  const behaviorSubject: BehaviorSubject<T> = {
    type: "subject",
    name: "behaviorSubject",
    peek,
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(behaviorSubject, ...steps),
    next,
    complete,
    completed: () => base.completed,
    error,
  };

  return behaviorSubject;
}
