import { Emission, Operator, Pipeline, Receiver, Subscribable, SubscribableHooks, SubscribableInternals, Subscription, createPipeline, createReceiver, eventBus, flags, hooks, internals, isOperator } from "../abstractions";
import { awaitable, hook } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  name?: string;
  operators: Operator[];
  emissionCounter: number;

  startTimestamp: number | undefined;
  stopTimestamp: number | undefined;

  run: () => Promise<void>;

  [internals]: SubscribableInternals & {
    head: Operator | undefined;
    tail: Operator | undefined;
    reduce: (operators: Operator[], initialEmission: Emission, source: Stream) => Emission;
    chain: (...operators: Operator[]) => Stream<T>;
    emit: (args: { emission: Emission; source: any }) => Promise<any>;
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
  let autoComplete = false;
  let unsubscribed = false;
  let stopped = false;

  let currentValue: T | undefined;

  let emissionCounter = 0;

  let startTimestamp: number | undefined;
  let stopTimestamp: number | undefined;

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
      } catch (error) {
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' }); // Handle any errors
    } finally {
      eventBus.enqueue({ target: stream, type: 'complete' }); // Trigger complete hook
      !stream[internals].shouldComplete() && (stream[flags].isAutoComplete = true);

      await finalize.waitForCompletion();
      running = false; stopped = true;
      stream.stopTimestamp = performance.now();
      operators.forEach(operator => operator.cleanup());
    }
  };

  const complete = async (): Promise<void> => {
    if(!running && !stopped && !unsubscribed) {
      await onStart.waitForCompletion();
    }

    if(running && !stopped) {
      stream[flags].isUnsubscribed = true;
      await finalize.waitForCompletion();
    }
  };

  const awaitStart = () => commencement.promise();
  const awaitCompletion = () => completion.promise();

  const reduce = function (
    operators: Operator[],
    initialEmission: Emission,
    source: Stream
  ): Emission {
    let accumulator: Emission = initialEmission;
    let errorHandled = false;

    // Loop through all operators
    for (let i = 0; i < operators.length; i++) {
      const operator = operators[i];

      try {

        if ('stream' in operator) {
          source.emissionCounter++;
        }
        // Apply the operator's handle function to the accumulator emission
        let emission = accumulator;

        // If the operator has a handle function, use it to process the emission
        if (operator.handle && !emission.failed && !emission.pending) {
          emission = operator.handle(emission, source);
        }

        // If the emission is not phantom, failed, or pending, increment the emission counter
        if (i === operators.length - 1 && !emission.phantom && !emission.failed && !emission.pending) {
          source.emissionCounter++; // or use appropriate emission counter logic
        }

        if (emission.failed) {
          throw emission.error;
        }

        // Handle the emission with the provided handle function
        accumulator = emission;

      } catch (error) {
        // In case of any exception during emission processing, mark emission as failed
        accumulator.failed = true;
        accumulator.error = error;

        // Look for catchError operator to handle the error
        for (let j = i + 1; j < operators.length; j++) {
          const nextOperator = operators[j];
          if (nextOperator.name === 'catchError') {
            // Handle the error and stop iteration
            accumulator = nextOperator.handle(accumulator, source);
            errorHandled = true;
            break; // Stop processing further operators
          }
        }

        // If no catchError operator is found, rethrow the error
        if (!errorHandled) {
          throw error;
        }

        // If error was handled, break out of the loop (no further operators processed)
        break;
      }
    }

    return accumulator;
  };

  const chain = function(...newOperators: Operator[]): Stream<T> {
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

  const emit = async function({ emission, source }: { emission: Emission; source: any }): Promise<any> {
    try {
      emission.timestamp = performance.now();

      let next = isStream(source) ? source[internals].head : undefined;
      next = isOperator(source) ? source.next : next;

      if (emission.failed) throw emission.error;

      if (next === undefined && !emission.phantom && !emission.pending) {
        stream.emissionCounter++;
      }

      if (!emission.phantom && !emission.pending) {
        emission = next?.process(emission, stream) ?? emission;
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
      return () => ({ target: stream, payload: { error }, type: 'error' });
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

    // Start the stream if it isn't running and stopping hasn't been requested
    if (!running && !unsubscribed) {
      running = true;
      stream.startTimestamp = performance.now();
      queueMicrotask(stream.run);
    }

    // Create the subscription object
    const subscription: Subscription = () => currentValue;
    subscription.subscribed = performance.now();
    subscription.unsubscribed = undefined;

    // Define the bound callback for handling emissions
    const boundCallback = ({ emission }: any) => {
      currentValue = emission.value;

      try {
        if (emission.failed && receiver.error) {
          receiver.error(emission.error); // Call `error` if emission failed
        } else {
          const rootEmissionTimestamp = emission.root().timestamp;
          if (receiver.next && subscription.subscribed <= rootEmissionTimestamp && ((subscription.unsubscribed && subscription.unsubscribed >= rootEmissionTimestamp) || (stream.stopTimestamp || performance.now()) >= rootEmissionTimestamp)) {
            receiver.next(emission.value); // Call `next` for successful emissions
          }
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
          if (receiver.complete) finalize.remove(receiver, receiver.complete);
          if (receiver.error) onError.remove(receiver, errorCallback);
          subscribers.remove(boundCallback);
        };

        if (!stopped) {
          stream.complete().then(cleanup);
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
    return createPipeline<T>(stream)[internals].chain(...operators);
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
    stopTimestamp,
    startTimestamp,
    get value() {
      return currentValue;
    },

    [internals]: {
      head,
      tail,
      reduce,
      chain,
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
      }
    }
  };

  onEmission.chain(stream, stream[internals].emit);
  return stream; // Return the stream instance
}
