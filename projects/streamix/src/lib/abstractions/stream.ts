import { Emission, Operator, Pipeline, Receiver, Subscribable, SubscribableInternals, Subscription, createPipeline, createReceiver, eventBus, flags, internals, isOperator } from "../abstractions";
import { awaitable, createEventEmitter } from "../utils";

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
    chain: (...operators: Operator[]) => Stream<T>;
    emit: (args: { emission: Emission; source: any }) => Promise<any>;
    awaitStart: () => Promise<void>;
  }
};

export function isStream<T>(obj: any): obj is Stream<T> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.run === 'function'
  );
}

export function createStream<T = any>(runFn: (this: Stream<T>, params?: any) => Promise<void> | void): Stream<T> {
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

  const emitter = createEventEmitter();

  const run = async () => {
    try {
      // Trigger start hook
      eventBus.enqueue({ target: stream, type: 'start' });
      commencement.resolve();

      const result = runFn.call(stream); // Execute the run function with the stream instance

      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (error: any) {
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' });
    } finally {
      await complete();
    }
  };

  const complete = async (): Promise<void> => {
    // Trigger complete hook
    eventBus.enqueue({ target: stream, type: 'complete' });

    // Automatically complete if required
    if (!stream[internals].shouldComplete()) {
      stream[flags].isAutoComplete = true;
    }

    // Wait for finalization and clean up
    await emitter.waitForCompletion('finalize');
    running = false;
    stopped = true;
    stream.stopTimestamp = performance.now();
  };

  const awaitStart = () => commencement.promise();
  const awaitCompletion = () => completion.promise();

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
      let next = isStream(source) ? source[internals].head : undefined;
      next = isOperator(source) ? source.next : next;

      if (emission.error) throw emission.error;

      if (next === undefined && !emission.phantom && !emission.pending) {
        stream.emissionCounter++;
      }

      if (!emission.phantom && !emission.pending) {
        emission = next?.process(emission, stream) ?? emission;
      }

      if (emission.error) throw emission.error;

      if (!emission.phantom && !emission.pending) {
        await emitter.emit('subscribers', { emission, source });
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
    const completeCallback = () => receiver.complete!();
    const errorCallback = ({ error }: any) => receiver.error!(error);

    // Chain the `complete` method to the `onStop` hook if present
    if (receiver.complete) {
      emitter.on('finalize', completeCallback);
    }

    if (receiver.error) {
      emitter.on('error', errorCallback);
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
        if (emission.error && receiver.error) {
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
          if (receiver.complete) emitter.off('finalize', completeCallback);
          if (receiver.error) emitter.off('error', errorCallback);
          emitter.off('subscribers', boundCallback);
        };

        if (!stopped) {
          if (emitter.getCallbackNumber('subscribers') === 1) {
            stream[flags].isUnsubscribed = true;
          }
          stream.complete().then(cleanup);
        }
      }
    };

    subscription.started = commencement.promise() as unknown as Promise<void>;
    subscription.completed = completion.promise() as unknown as Promise<void>;

    // Add the bound callback to the subscribers
    emitter.on('subscribers', boundCallback);

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
    emitter,
    emissionCounter,
    stopTimestamp,
    startTimestamp,
    get value() {
      return currentValue;
    },

    [internals]: {
      head,
      tail,
      chain,
      emit,
      awaitStart,
      awaitCompletion,
      shouldComplete,
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

  emitter.on('emission', (params) => stream[internals].emit(params));
  return stream; // Return the stream instance
}
