import { Operator, createPipeline, Pipeline, Subscription, Emission, Subscribable, isOperator, isReceiver, Receiver, createReceiver, hooks, SubscribableHooks, SubscribableInternals, internals, flags } from "../abstractions";
import { eventBus } from "../abstractions";
import { hook, Hook, awaitable } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  name?: string;
  operators: Operator[];
  emissionCounter: number;
  run: () => Promise<void>;

  [internals]: SubscribableInternals & {
    head: Operator | undefined;
    tail: Operator | undefined;
    bindOperators: (...operators: Operator[]) => Stream<T>;
    emit: (args: { emission: Emission; source: any }) => Promise<void>;
    awaitStart: () => Promise<void>;
  },

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
  const operators: Operator[] = [];
  let head: Operator | undefined;
  let tail: Operator | undefined;

  const commencement = awaitable<void>();
  const completion = awaitable<void>();

  let running = false;
  let pending = false;
  let autoComplete = false;
  let unsubscribed = false;
  let stopped = false;

  let currentValue: T | undefined;

  let emissionCounter = 0;

  const onStart = hook();
  const onEmission = hook();
  const onComplete = hook();
  const onError = hook();
  const finalize = hook();
  const subscribers = hook();

  const run = async () => {
    try {
      eventBus.enqueue({ target: stream, type: 'start' }); // Trigger start hook
      commencement.resolve();
      await runFn.call(stream); // Pass the stream instance to the run function
      eventBus.enqueue({ target: stream, type: 'complete' }); // Trigger complete hook
    } catch (error) {
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' }); // Handle any errors
    } finally {
      eventBus.enqueue({ target: stream, type: 'finalize' }); // Finalize the stop hook
      finalize.once(() => {
        running = false; stopped = true;
        operators.forEach(operator => operator.cleanup());
      });
    }
  };

  const complete = async (): Promise<void> => {
    if (running) {
      if (stream[hooks].subscribers.length === 1) {
        stream[flags].isUnsubscribed = true;
      }
      if(!stopped) {
        await finalize.waitForCompletion();
      }
    }
  };

  const awaitStart = () => commencement.promise();
  const awaitCompletion = () => completion.promise();

  const bindOperators = function(...newOperators: Operator[]): Stream<T> {
    operators.length = 0;
    head = undefined; tail = undefined;

    newOperators.forEach((operator, index) => {
      operators.push(operator);

      if (!head) {
        head = operator;
      } else {
        tail!.next = operator;
      }
      tail = operator;

      if ('stream' in operator && index !== newOperators.length - 1) {
        throw new Error('Only the last operator in a stream can contain an outerStream property.');
      }
    });

    stream[internals].head = head; stream[internals].tail = tail;
    return stream;
  };

  const emit = async function({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {

      let next = isStream(source) ? source[internals].head : undefined;
      next = isOperator(source) ? source.next : next;

      if (emission.failed) throw emission.error;

      if (next === undefined && !emission.phantom && !emission.pending) {
        emissionCounter++;
      }

      if (!emission.phantom && !emission.pending) {
        emission = await (next?.process(emission, stream) ?? Promise.resolve(emission));
      }

      if (emission.failed) throw emission.error;

      if (!emission.phantom && !emission.pending) {
        await subscribers.parallel({ emission, source });
      }

      if (!emission.pending) {
        emission.resolve()
      }
    } catch (error) {
      emission.reject(error);
    }
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    // Convert a callback into a Receiver if needed
    const receiver = createReceiver(callbackOrReceiver);
    const errorCallback = ({ error }: any) => receiver.error!(error);

    // Chain the `complete` method to the `onStop` hook if present
    if (receiver.complete) {
      finalize.chain(receiver, receiver.complete);
    }

    if (receiver.error) {
      onError.chain(receiver, errorCallback);
    }

    // Define the bound callback for handling emissions
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;

      try {
        if (emission.failed && receiver.error) {
          receiver.error(emission.error); // Call `error` if emission failed
        } else if (receiver.next) {
          receiver.next(emission.value); // Call `next` for successful emissions
        }
      } catch (err) {
        console.error('Error in Receiver callback:', err);
      }

      return Promise.resolve();
    };

    unsubscribed = false;
    // Add the bound callback to the subscribers
    subscribers.chain(boundCallback);

    // Start the stream if it isn't running and stopping hasn't been requested
    if (!running && !unsubscribed) {
      running = true;
      queueMicrotask(stream.run);
    }

    // Create the subscription object
    const subscription: Subscription = () => currentValue;
    subscription.unsubscribed = false;

    subscription.unsubscribe = () => {
      if (!subscription.unsubscribed) {
        subscription.unsubscribed = true;
        
        await stream.complete();
          
        if (receiver.complete) {
          finalize.remove(receiver, receiver.complete);
        }

        if (receiver.error) {
          onError.remove(receiver, errorCallback);
        }
        
        subscribers.remove(boundCallback);
      }
    };

    subscription.started = commencement.promise();
    subscription.completed = completion.promise();

    return subscription as Subscription;
  };

  const pipe = function(...operators: Operator[]): Pipeline<T> {
    return createPipeline<T>(stream)[internals].bindOperators(...operators);
  };

  const shouldComplete = () => autoComplete || unsubscribed;

  const stream = {
    type: "stream" as "stream",
    operators,
    subscribe,
    pipe,
    run,
    complete,
    emissionCounter,
    get value() {
      return currentValue;
    },

    [internals]: {
      head,
      tail,
      bindOperators,
      emit,
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
      get onEmission() {
        return onEmission;
      },
      get finalize() {
        return finalize;
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
      },
      get isPending() {
        return pending;
      },
      set isPending(value: boolean) {
        pending = value;
      }
    }
  };

  onEmission.chain(stream, stream[internals].emit);
  return stream; // Return the stream instance
}
