import {
  CallbackReturnType,
  createQueue,
  createReceiver,
  createSingleValueBuffer,
  createSubscription,
  Operator,
  pipeStream,
  Receiver,
  Stream,
  Subscription
} from "../../abstractions";

export type AsyncSubject<T = any> = Stream<T> & {
  next(value: T): Promise<void>;
  complete(): Promise<void>;
  error(err: any): Promise<void>;
  completed(): boolean;
  get value(): T | undefined;
};

export function createAsyncSubject<T = any>(): AsyncSubject<T> {
  const buffer = createSingleValueBuffer<T>();
  const queue = createQueue();
  let latestValue: T | undefined = undefined;
  let isCompleted = false;
  let hasError = false;

  const next = async (value: T) => {
    latestValue = value;
    queue.enqueue(async () => {
      if (isCompleted || hasError) return;
      await buffer.write(value);
    });
  };

  const complete = async () => {
    queue.enqueue(async () => {
      if (isCompleted) return;
      isCompleted = true;
      await buffer.complete();
    });
  };

  const error = async (err: any) => {
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
          const result = await buffer.read(readerId);
          if (result.done) break;
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

  const subject: AsyncSubject<T> = {
    type: "subject",
    name: "subject",
    get value() {
      return latestValue;
    },
    subscribe,
    pipe(...steps: Operator[]) {
      return pipeStream(this, ...steps);
    },
    next,
    complete,
    completed: () => isCompleted,
    error,
  };

  return subject;
}
