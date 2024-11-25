import { Operator, createPipeline, Pipeline, Subscription, Emission, Subscribable, isOperatorType as isOperator } from "../abstractions";
import { eventBus } from ".";
import { hook, Hook, awaitable, createLock, SimpleLock } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  operators: Operator[];
  head: Operator | undefined;
  tail: Operator | undefined;
  bindOperators: (...operators: Operator[]) => Stream<T>;
  emit: (args: { emission: Emission; source: any }) => Promise<void>;
  run: () => Promise<void>; // Run stream logic
  name?: string;
  subscribers: Hook;
  lock: SimpleLock;
  emissionCounter: number;
  commencement: Promise<void>;
  completion: Promise<void>;
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

  const completion = awaitable<void>();
  const commencement = awaitable<void>();
  let lock = createLock();

  let autoComplete = false;
  let stopRequested = false;
  let stopped = false;
  let running = false;
  let currentValue: T | undefined;

  let emissionCounter = 0;

  const onStart = hook();
  const onComplete = hook();
  const onStop = hook();
  const onError = hook();
  const onEmission = hook();
  const subscribers = hook();

  const run = async () => {
    try {
      eventBus.enqueue({ target: stream, type: 'start' }); // Trigger start hook
      await onStart.waitForCompletion();
      commencement.resolve();
      await runFn.call(stream); // Pass the stream instance to the run function
      eventBus.enqueue({ target: stream, type: 'complete' }); // Trigger complete hook
      await onComplete.waitForCompletion();
    } catch (error) {
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' }); // Handle any errors
      await onError.waitForCompletion();
    } finally {
      eventBus.enqueue({ target: stream, type: 'stop' }); // Finalize the stop hook
      await onStop.waitForCompletion();
      stopped = true; running = false;
      operators.forEach(operator => operator.cleanup());
    }
  };

  const complete = async (): Promise<void> => {
    if(!stream.isRunning && !stream.isStopped) {
      await onStart.waitForCompletion();
    }

    if(!stream.isStopped && !stream.isAutoComplete) {
      stream.isStopRequested = true;
      await onStop.waitForCompletion();
    }
  };

  const awaitCompletion = () => completion.promise();

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
      emissionCounter++;

      let next = isStream(source) ? source.head : undefined;
      next = isOperator(source) ? source.next : next;

      if (emission.failed) throw emission.error;

      if (!emission.phantom && !emission.pending) {
        emission = await (next?.process(emission, stream) ?? Promise.resolve(emission));
      }

      if (emission.failed) throw emission.error;

      if (!emission.phantom && !emission.pending) {
        await subscribers.parallel({ emission, source });
      }

      if (!emission.pending) {
        emission.complete = true;
        emission.resolve()
      }
    } catch (error) {
      emission.reject(error);
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' });
    }
  };

  const subscribe = (callback?: (value: T) => void): Subscription => {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    subscribers.chain(boundCallback);

    if (!running && !stopRequested) {
      running = true;
      queueMicrotask(stream.run);
    }

    const subscription: Subscription = () => currentValue;
    subscription.unsubscribed = false;

    subscription.unsubscribe = () => {
      if(!subscription.unsubscribed) {
        stream.complete().then(() => subscribers.remove(boundCallback));
        subscription.unsubscribed = true;
      }
    };

    subscription.started = commencement.promise();
    subscription.completed = completion.promise();

    return subscription as Subscription;
  };

  const pipe = function(...operators: Operator[]): Pipeline<T> {
    return createPipeline<T>(stream).bindOperators(...operators);
  };

  const shouldComplete = () => autoComplete || stopRequested;

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
    emissionCounter,
    commencement: commencement.promise(),
    completion: completion.promise(),
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
      return autoComplete;
    },
    set isAutoComplete(value: boolean) {
      if (value && completion.state() === 'pending') completion.resolve();
      autoComplete = value;
    },
    get isStopRequested() {
      return stopRequested;
    },
    set isStopRequested(value: boolean) {
      if (value && completion.state() === 'pending') completion.resolve();
      stopRequested = value;
    },
    get isRunning() {
      return running;
    },
    set isRunning(value: boolean) {
      running = value;
    },
    get isStopped() {
      return stopped;
    },
    set isStopped(value: boolean) {
      stopped = value;
    }
  };

  stream.onEmission.chain(stream, stream.emit);
  return stream; // Return the stream instance
}
