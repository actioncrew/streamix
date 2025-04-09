import { createReceiver, createReplayBuffer, createQueue, createSubscription, Operator, pipeStream, Receiver, StreamMapper, Subscription } from "../abstractions";
import { createBaseSubject, Subject } from "../streams";

export type ReplaySubject<T = any> = Subject<T> & {
  getBuffer(): T[];
};

export function createReplaySubject<T = any>(bufferSize: number = 10): ReplaySubject<T> {
  // Use replay buffer instead of regular buffer
  const buffer = createReplayBuffer<T>(bufferSize);
  const queue = createQueue();
  
  const base = {
    queue,
    buffer,
    subscribers: new Map<Receiver<T>, number>(),
    completed: false,
    hasError: false,
    errorValue: null as any,
  };

  // --- Core Functions ---
  const next = (value: T) => {
    if (base.completed || base.hasError) return;
    queue.enqueue(() => buffer.write(value));
  };

  const complete = () => {
    if (base.completed) return;
    base.completed = true;
    queue.enqueue(async () => {
      buffer.complete();
      // Notify subscribers on next tick
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
      receiver.error!(err);
    }
    base.subscribers.clear();
  };

  // --- Subscription Logic ---
  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    let latestValue: T | undefined;

    const subscription = createSubscription(() => {
      if (!unsubscribing) {
        unsubscribing = true;
        base.queue.enqueue(async () => {
          cleanupAfterReceiver(receiver);
        });
      }
    });

    base.queue.enqueue(async () => {
      const readerId = await buffer.attachReader();
      base.subscribers.set(receiver, readerId);

      // Immediate replay of buffered values + new values
      queueMicrotask(async () => {
        try {
          while (true) {
            const result = await buffer.read(readerId);
            if (result.done) break;
            latestValue = result.value;
            receiver.next(result.value);
          }
        } catch (err) {
          receiver.error?.(err);
        } finally {
          receiver.complete?.();
          cleanupAfterReceiver(receiver);
        }
      });
    });

    return Object.assign(subscription, {
      value: () => latestValue
    });
  };

  // --- Helper Functions ---
  const cleanupAfterReceiver = (receiver: Receiver<T>) => {
    const readerId = base.subscribers.get(receiver);
    if (readerId !== undefined) {
      base.subscribers.delete(receiver);
      Promise.resolve().then(() => {
        buffer.detachReader(readerId);
      });
    }
  };

  const getBuffer = (): T[] => {
    const result: T[] = [];
    const start = Math.max(0, buffer.readCount - bufferSize);
    
    for (let i = start; i < buffer.readCount; i++) {
      const value = buffer.buffer[i % bufferSize];
      if (value !== undefined) result.push(value);
    }
    
    return result;
  };

  // --- Subject Interface ---
  const peek = (subscription?: Subscription): T | undefined => {
    if (subscription) {
      return (subscription as any).value();
    }
    const values = getBuffer();
    return values.length > 0 ? values[values.length - 1] : undefined;
  };

  const subject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    peek,
    subscribe,
    pipe: (...steps) => pipeStream(subject, ...steps),
    next,
    complete,
    completed: () => base.completed,
    error,
    getBuffer,
  };

  return subject;
    }
