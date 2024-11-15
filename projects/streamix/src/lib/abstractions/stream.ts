import { Operator, createPipeline, Pipeline, Subscription, Emission, Subscribable, pipe, isOperatorType as isOperator } from "../abstractions";
import { eventBus } from "../../lib";
import { hook, Hook, promisified, createLock, Lock } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  operators: Operator[];
  head: Operator | undefined;
  tail: Operator | undefined;
  bindOperators: (...operators: Operator[]) => Stream<T>;
  emit: (args: { emission: Emission; source: any }) => Promise<void>;
  run: () => Promise<void>; // Run stream logic
  name?: string;
  subscribers: Hook;
  lock: Lock;
};

export function isStream<T>(obj: any): obj is Stream<T> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.run === 'function'
  );
}

export function createStream<T = any>(runFn: (this: Stream<T>, params?: any) => Promise<void>): Stream<T> {
  const operators: Operator[] = [];
  let head: Operator | undefined;
  let tail: Operator | undefined;

  const completionPromise = promisified<void>();
  const startedPromise = promisified<void>();
  let lock = createLock();

  let isAutoComplete = false;
  let isStopRequested = false;
  let isStopped = false;
  let isRunning = false;
  let currentValue: T | undefined;

  const onStart = hook();
  const onComplete = hook();
  const onStop = hook();
  const onError = hook();
  const onEmission = hook();
  const subscribers = hook();

  const run = async () => {
    eventBus.enqueue({ target: stream, type: 'start' }); // Trigger start hook
    try {
      await onStart.waitUntilComplete();
      startedPromise.resolve();
      await runFn.call(stream); // Pass the stream instance to the run function
      eventBus.enqueue({ target: stream, type: 'complete' }); // Trigger complete hook
      await onComplete.waitUntilComplete();
    } catch (error) {
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' }); // Handle any errors
    } finally {
      eventBus.enqueue({ target: stream, type: 'stop' }); // Finalize the stop hook
      await onStop.waitUntilComplete();
      isStopped = true; isRunning = false;
      operators.forEach(operator => operator.cleanup());
    }
  };

  const complete = async (): Promise<void> => {
    const releaseLock = await lock.acquire();
    try {
      if(!stream.isRunning && !stream.isStopped) {
        await onStart.waitUntilComplete();
      }

      if(!stream.isStopped && !stream.isAutoComplete) {
        stream.isStopRequested = true;
        await onStop.waitUntilComplete();
      }
    }
    finally {
      releaseLock();
    }
  };

  const awaitCompletion = () => completionPromise.promise();

  const bindOperators = function(...newOperators: Operator[]): Stream<T> {
    operators.length = 0;
    stream.head = undefined;
    stream.tail = undefined;

    newOperators.forEach((operator, index) => {
      operators.push(operator);

      if (!stream.head) {
        stream.head = operator;
      } else {
        stream.tail!.next = operator;
      }
      stream.tail = operator;

      if ('stream' in operator && index !== newOperators.length - 1) {
        throw new Error('Only the last operator in a stream can contain an outerStream property.');
      }
    });

    return stream;
  };

  const emit = async function({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      let next = isStream(source) ? source.head : undefined;
      next = isOperator(source) ? source.next : next;

      if (emission.isFailed) throw emission.error;

      if (!emission.isPhantom) {
        emission = await (next?.process(emission, stream) ?? Promise.resolve(emission));
      }

      if (emission.isFailed) throw emission.error;

      if (!emission.isPhantom) {
        await subscribers.parallel({ emission, source });
      }

      emission.isComplete = true;
    } catch (error) {
      emission.isFailed = true;
      emission.error = error;
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' });
    }
  };

  const subscribe = (callback?: (value: T) => void): Subscription => {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    subscribers.chain(boundCallback);

    if (!isRunning && !isStopRequested) {
      isRunning = true;
      queueMicrotask(stream.run);
    }

    const subscription: any = () => currentValue;
    subscription.unsubscribe = () => {
      stream.lock.acquire().then((releaseLock) => {
        try {
          stream.onStop.once(() => {
            subscribers.remove(boundCallback);
          });

          if (!stream.isAutoComplete) {
            stream.isStopRequested = true;
          }
        } finally {
          releaseLock(); // Always release the lock after execution
        }
      });
    };

    subscription.started = startedPromise.promise();
    subscription.completed = completionPromise.promise();

    return subscription as Subscription;
  };

  const pipe = function(...operators: Operator[]): Pipeline<T> {
    return createPipeline<T>(stream).bindOperators(...operators);
  };

  const shouldComplete = () => isAutoComplete || isStopRequested;

  const stream = {
    type: "stream" as "stream",
    operators,
    head,
    tail,
    lock,
    bindOperators,
    emit,
    subscribe,
    pipe,
    run,
    awaitCompletion,
    complete,
    shouldComplete,
    get value() {
      return currentValue;
    },
    get onStart() {
      return onStart;
    },
    get onComplete() {
      return onComplete;
    },
    get onStop() {
      return onStop;
    },
    get onError() {
      return onError;
    },
    get onEmission() {
      return onEmission;
    },
    get subscribers() {
      return subscribers;
    },
    get isAutoComplete() {
      return isAutoComplete;
    },
    set isAutoComplete(value: boolean) {
      if (value) completionPromise.resolve();
      isAutoComplete = value;
    },
    get isStopRequested() {
      return isStopRequested;
    },
    set isStopRequested(value: boolean) {
      if (value) completionPromise.resolve();
      isStopRequested = value;
    },
    get isRunning() {
      return isRunning;
    },
    get isStopped() {
      return isStopped;
    }
  };

  stream.onEmission.chain(stream, stream.emit);
  return stream; // Return the stream instance
}
