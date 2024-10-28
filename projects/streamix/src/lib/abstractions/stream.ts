import { Operator, createPipeline, Pipeline, Subscription, Emission, Subscribable } from "../abstractions";
import { hook, promisified } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  emit: (args: { emission: Emission; source: any }) => Promise<void>;
  run: () => Promise<void>; // Run stream logic
  name?: string;
};

export function isStream<T>(obj: any): obj is Stream<T> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.run === 'function'
  );
}

export function createStream<T = any>(runFn: (this: Stream<T>, params?: any) => Promise<void>): Stream<T> {
  const completionPromise = promisified<void>();

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

  const run = async () => {
    try {
      await onStart.process(); // Trigger start hook
      await runFn.call(streamInstance); // Pass the stream instance to the run function
      await onComplete.process(); // Trigger complete hook
    } catch (error) {
      await onError.process({ error }); // Handle any errors
    } finally {
      isStopped = true;
      isRunning = false;
      await onStop.process(); // Finalize the stop hook
    }
  };

  const complete = async (): Promise<void> => {
    if (!isAutoComplete) {
      isStopRequested = true;
      return new Promise<void>((resolve) => {
        onStop.once(() => resolve());
        completionPromise.resolve();
      });
    }
    return completionPromise.promise(); // Ensure the completion resolves correctly
  };

  const awaitCompletion = () => completionPromise.promise();

  const emit = async (args: { emission: Emission; source: any }): Promise<void> => {
    try {
      if (args.emission.isFailed && args.emission.error) throw args.emission.error;

      if (!args.emission.isPhantom) {
        await onEmission.parallel(args);
      }

      args.emission.isComplete = true;
    } catch (error: any) {
      args.emission.isFailed = true;
      args.emission.error = error;
      await onError.process({ error });
    }
  };

  const subscribe = (callback?: (value: T) => void): Subscription => {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    onEmission.chain(boundCallback);

    if (!isRunning) {
      isRunning = true;
      queueMicrotask(run);
    }

    const value: any = () => currentValue;
    value.unsubscribe = async () => {
      await complete();
      onEmission.remove(boundCallback);
    };

    return value;
  };

  const pipe = (...operators: Operator[]): Pipeline<T> => {
    return createPipeline<T>(streamInstance).pipe(...operators);
  };

  const shouldComplete = () => isAutoComplete || isStopRequested;

  const streamInstance = {
    type: "stream" as "stream",
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

  return streamInstance; // Return the stream instance
}
