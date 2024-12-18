import { Operator, createPipeline, Pipeline, Subscription, Emission, Subscribable, isOperator, isReceiver, Receiver, createReceiver, hooks, SubscribableHooks, SubscribableInternals, internals, flags } from "../abstractions";
import { eventBus } from "../abstractions";
import { hook, awaitable } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  name?: string;
  emissionCounter: number;
  run: () => Promise<void>;

  [internals]: SubscribableInternals;
  [hooks]: SubscribableHooks;
};

export function isStream<T>(obj: any): obj is Stream<T> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.run === 'function'
  );
}

export function createStream<T = any>(runFn: (this: Stream<T>, params?: any) => Promise<void>): Stream<T> {

  const commencement = awaitable<void>();
  const completion = awaitable<void>();

  let running = false;
  let autoComplete = false;
  let unsubscribed = false;
  let stopped = false;

  let currentValue: T | undefined;

  let emissionCounter = 0;

  let startTimestamp: number;
  let stopTimestamp: number;

  const onStart = hook();
  const onComplete = hook();
  const onError = hook();
  const subscribers = hook();

  const run = async () => {
    try {
      eventBus.enqueue({ target: stream, type: 'start' }); // Trigger start hook
      commencement.resolve();
      await runFn.call(stream); // Pass the stream instance to the run function
      eventBus.enqueue({ target: stream, type: 'complete' }); // Trigger complete hook
      !stream[flags].isUnsubscribed && (stream[flags].isAutoComplete = true);
    } catch (error) {
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' }); // Handle any errors
    } finally {
      running = false; stopped = true;
    }
  };

  const complete = async (): Promise<void> => {
    if(!running && !stopped && !unsubscribed) {
      await onStart.waitForCompletion();
    }

    if(running && !stopped) {
      stream[flags].isUnsubscribed = true;
      stopTimestamp = performance.now();
    }
  };

  const awaitStart = () => commencement.promise();
  const awaitCompletion = () => completion.promise();

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    // Convert a callback into a Receiver if needed
    const receiver = createReceiver(callbackOrReceiver);
    const errorCallback = ({ error }: any) => receiver.error!(error);

    // Chain the `complete` method to the `onStop` hook if present
    if (receiver.complete) {
      onComplete.chain(receiver, receiver.complete);
    }

    if (receiver.error) {
      onError.chain(receiver, errorCallback);
    }

    // Start the stream if it isn't running and stopping hasn't been requested
    if (!running && !unsubscribed) {
      running = true;
      startTimestamp = performance.now();
      queueMicrotask(stream.run);
    }

    // Create the subscription object
    const subscription: Subscription = () => currentValue;

    // Define the bound callback for handling emissions
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      emissionCounter++;

      try {
        if (emission.failed && receiver.error) {
          receiver.error(emission.error); // Call `error` if emission failed
        } else if (receiver.next && ((subscription.unsubscribed && subscription.unsubscribed >= emission.root().timestamp) || (stopTimestamp || performance.now()) >= emission.root().timestamp)) {
          receiver.next(emission.value); // Call `next` for successful emissions
        }
      } catch (err) {
        console.error('Error in Receiver callback:', err);
      }

      return Promise.resolve();
    };

    subscription.unsubscribe = () => {
      if (!subscription.unsubscribed) {

        subscription.unsubscribed = performance.now();

        const cleanup = () => {
          if (receiver.complete) onComplete.remove(receiver, receiver.complete);
          if (receiver.error) onError.remove(receiver, errorCallback);
          subscribers.remove(boundCallback);
        };

        if (!stopped) {
          stream.complete().then(cleanup);
        } else {
          cleanup();
        }
      }
    };

    subscription.started = commencement.promise() as unknown as Promise<void>;
    subscription.completed = completion.promise() as unknown as Promise<void>;

    // Add the bound callback to the subscribers
    subscribers.chain(boundCallback);

    return subscription as Subscription;
  };

  const pipe = function(...operators: Operator[]): Pipeline<T> {
    return createPipeline<T>(stream)[internals].bindOperators(...operators);
  };

  const shouldComplete = () => unsubscribed;

  const stream = {
    type: "stream" as "stream",
    subscribe,
    pipe,
    run,
    complete,
    emissionCounter,
    get value() {
      return currentValue;
    },

    [internals]: {
      awaitStart,
      awaitCompletion,
      shouldComplete,
    },

    [hooks]: {
      get onStart() {
        return onStart;
      },
      get onComplete() {
        return onComplete;
      },
      get onError() {
        return onError;
      },
      get subscribers() {
        return subscribers;
      }
    },

    [flags]: {
      get isAutoComplete() {
        return autoComplete;
      },
      set isAutoComplete(value: boolean) {
        if (value && completion.state() === 'pending') completion.resolve();
        autoComplete = value;
      },
      get isUnsubscribed() {
        return unsubscribed;
      },
      set isUnsubscribed(value: boolean) {
        if (value && completion.state() === 'pending') completion.resolve();
        unsubscribed = value;
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
    }
  };

  return stream; // Return the stream instance
}
