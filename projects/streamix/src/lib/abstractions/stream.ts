import { Emission, Operator, Pipeline, Subscription } from '../abstractions';
import { hook, promisified } from '../utils';

export function Stream<T = any>() {
  const isAutoComplete = promisified<boolean>(false);
  const isStopRequested = promisified<boolean>(false);

  const isFailed = promisified<any>(undefined);
  const isStopped = promisified<boolean>(false);
  const isUnsubscribed = promisified<boolean>(false);
  const isRunning = promisified<boolean>(false);

  const subscribers = hook();
  const onStart = hook();
  const onComplete = hook();
  const onStop = hook();
  const onError = hook();
  const onEmission = hook();

  let currentValue: T | undefined;

  const init = () => {
    if (!onEmission.contains(stream, emit)) {
      onEmission.chain(stream, emit);
    }
  };

  const startWithContext = (context: any) => {
    context.init();

    if (isRunning() === false) {
      isRunning.resolve(true);

      queueMicrotask(async () => {
        try {
          await onStart.process();
          await context.run();

          await onComplete.process();
        } catch (error) {
          isFailed.resolve(error);

          if (onError.length > 0) {
            await onError.process({ error });
          }
        } finally {
          await onStop.process();
          isStopped.resolve(true);
          isRunning.reset();

          await context.cleanup();
        }
      });
    }
  };

  const start = () => {

  };

  const pipe = () => {

  };

  const run = () => {
    throw new Error('Abstract method')
  };

  const cleanup = async () => {
    onEmission.remove(stream, emit);
  };

  const complete = (): Promise<void> => {
    isStopRequested.resolve(true);
    return isStopped.then(() => Promise.resolve());
  };

  const emit = async ({ emission, source }: { emission: Emission; source: any }): Promise<void> => {
    try {
      if (emission.isFailed) {
        throw emission.error;
      }

      if (!emission.isPhantom) {
        await subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;

      isFailed.resolve(error);
      if (onError.length > 0) {
        await onError.process({ error });
      }
    }
  };

  const subscribe = (callback?: (value: T) => void): Subscription => {
    const boundCallback = (value: T) => {
      currentValue = value;
      return callback ? Promise.resolve(callback(value)) : Promise.resolve();
    };

    subscribers.chain(stream, boundCallback);
    startWithContext(stream);

    return {
      unsubscribe: async () => {
        subscribers.remove(stream, boundCallback);
        if (subscribers.length === 0) {
          isUnsubscribed.resolve(true);
          await complete();
        }
      }
    };
  };

  // Returning the stream function that holds the current value
  const stream = () => currentValue;

  // Attach properties to the function
  stream.isAutoComplete = isAutoComplete;
  stream.isStopRequested = isStopRequested;
  stream.isFailed = isFailed;
  stream.isStopped = isStopped;
  stream.isUnsubscribed = isUnsubscribed;
  stream.isRunning = isRunning;
  stream.subscribers = subscribers;
  stream.onStart = onStart;
  stream.onComplete = onComplete;
  stream.onStop = onStop;
  stream.onError = onError;
  stream.onEmission = onEmission;

  stream.shouldComplete = () => isAutoComplete() || isUnsubscribed() || isStopRequested();
  stream.awaitCompletion = () => promisified.race([isAutoComplete, isUnsubscribed, isStopRequested]);

  stream.run = run;
  stream.complete = complete;
  stream.init = init;
  stream.subscribe = subscribe;
  stream.emit = emit;
  stream.cleanup = cleanup;
  stream.start = () => stream.startWithContext(stream);
  stream.pipe = (...operators: Operator[]) => Pipeline<T>(stream).pipe(...operators);
  stream.startWithContext = startWithContext;

  return stream;
}
