import { createSubject } from "../../lib";
import { createEmission, createReceiver, createSubscription, Emission, eventBus, Operator, Receiver, StreamOperator, Subscription } from "../abstractions";
import { awaitable, createEventEmitter, EventEmitter } from "../utils";

export const flags = Symbol('Stream');

export type Stream<T = any> = {
  (callback?: ((value: T) => any) | Receiver): Subscription;

  type: "stream" | "subject";
  name?: string;

  value: T | undefined;

  emissionCounter: number;

  startTimestamp: number | undefined;
  stopTimestamp: number | undefined;

  emitter: EventEmitter;

  run: () => Promise<void>;
  next: (emission: Emission) => Emission;
  error: (error: any) => void;

  emit: (args: { emission: Emission; source: any }) => Promise<any>;

  shouldComplete: () => boolean;
  awaitCompletion: () => Promise<void>;
  complete: () => Promise<void>;

  pipe: (...steps: (Operator | StreamOperator)[]) => Stream;
  subscribe: (callback?: ((value: T) => any) | Receiver) => Subscription;

  [flags]: {
    isAutoComplete: boolean;
    isUnsubscribed: boolean;

    isStopped: boolean;
    isRunning: boolean;
  };
};

export function isStream<T>(obj: any): obj is Stream<T> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.run === 'function'
  );
}

export function createStream<T = any>(name: string, runFn: (this: Stream<T>, params?: any) => Promise<void> | void): Stream<T> {

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
    let promise: Promise<void> | void;
    try {
      eventBus.enqueue({ target: stream, type: 'start' }); // Trigger start hook
      promise = runFn.call(stream); // Pass the stream instance to the run function
      if (promise && typeof promise.then === 'function') {
        await promise;
      }
    } catch (error) {
      stream.error(error);
    } finally {
      !stream.shouldComplete() && (stream[flags].isAutoComplete = true);
      eventBus.enqueue({ target: stream, type: 'complete' }); // Trigger complete hook
    }
  };

  const next = (emission: Emission): Emission => {
    eventBus.enqueue({ target: stream, payload: { emission, source: stream }, type: 'emission' })
    return emission;
  };

  const error = (error: Error): void => {
    eventBus.enqueue({ target: stream, payload: { error }, type: 'error' });
  };

  const complete = async (): Promise<void> => {
    if(emitter.getCallbackCount('subscribers') === 1) {
      stream[flags].isUnsubscribed = true;
    }

    if(running && !stopped) {
      await emitter.waitForCompletion('finalize');
      running = false; stopped = true;
      stream.stopTimestamp = performance.now();
    }
  };

  const awaitCompletion = () => completion.promise();
  const shouldComplete = () => autoComplete || unsubscribed;

  const chain = function (this: Stream, ...operators: Operator[]): Stream {
    const output = createSubject();
    const pendingTasks = new Set<Promise<void>>(); // Use Set for efficient tracking
    let isCompleteCalled = false; // To ensure `complete` is only processed once

    const subscription = this({
      next: (value: any) => {
        let emission = createEmission({ value });
        for (let i = 0; i < operators.length; i++) {
          const operator = operators[i];
          if (operator?.name === "catchError") {
            continue;
          }

          try {
            emission = operator.handle(emission, this);
          } catch (error) {
            emission.error = error;
          }

          if (emission.error) {
            let foundCatchError = false;
            for (let j = i + 1; j < operators.length; j++) {
              if (operators[j]?.name === "catchError") {
                foundCatchError = true;
                emission = operators[j].handle(emission, this);
                i = j;
                break;
              }
            }
            if (!foundCatchError) {
              throw emission.error;
            }
          }

          if (emission.error || (emission.phantom && emission.pending)) {
            break;
          }
        }

        if (!emission.error && !emission.phantom && !output.shouldComplete()) {

          const task = output.next(emission.value).wait();

          // Track the task
          pendingTasks.add(task);

          // Clean up task once it’s completed
          task.finally(() => pendingTasks.delete(task));
        }
      },
      complete: () => {
        if (!isCompleteCalled) {
          isCompleteCalled = true;

          // If there are no pending tasks, complete immediately
          if (pendingTasks.size === 0) {
            output.complete();
            subscription.unsubscribe();
          } else {
            // Wait for all pending tasks before completing
            Promise.all(pendingTasks).then(() => {
              output.complete();
              subscription.unsubscribe();
            });
          }
        }
      }
    });

    return output;
  };


  // Instance method for `compose`
  const compose = function(this: Stream, ...operators: StreamOperator[]): Stream {
    return operators.reduce((acc: Stream, operator: StreamOperator) => operator(acc), this) as Stream;
  };

  // Instance method for `pipe`
  const pipe = function(this: Stream, ...steps: (Operator | StreamOperator)[]): Stream {
    let combinedStream: Stream = this;
    let operatorsGroup: Operator[] = [];

    // Process each step in the pipeline
    for (const step of steps) {
      if ('handle' in step) {
        // If it's a SimpleOperator, add it to the current group
        operatorsGroup.push(step);
      } else if (typeof step === 'function') {
        // Apply any pending SimpleOperators first
        if (operatorsGroup.length > 0) {
          combinedStream = chain.call(combinedStream, ...operatorsGroup);
          operatorsGroup = [];
        }

        // Apply the StreamOperator
        combinedStream = step(combinedStream);
      } else {
        throw new Error("Invalid step provided to pipe.");
      }
    }

    // Apply remaining SimpleOperators, if any
    if (operatorsGroup.length > 0) {
      combinedStream = chain.call(combinedStream, ...operatorsGroup);
    }

    return combinedStream as Stream;
  };

  const emit = async function({ emission, source }: { emission: Emission; source: any }): Promise<any> {
    try {
      if (!emission.error && !emission.phantom) {
        source.emissionCounter++;
        if(!emission.pending) {
          await emitter.emit('subscribers', { emission, source });
        }
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
    const subscription = createSubscription(
      () => currentValue,
      () => {
        if (!subscription.unsubscribed) {
          subscription.unsubscribed = performance.now();
          const cleanup = () => {
            if (receiver.complete) emitter.off('finalize', completeCallback);
            if (receiver.error) emitter.off('error', errorCallback);
            emitter.off('subscribers', boundCallback);
          };

          if (!stopped) {
            stream.complete().then(cleanup);
          }
        }
      }
    );

    // Define the bound callback for handling emissions
    const boundCallback = ({ emission }: any) => {

      try {
        if (emission.error && receiver.error) {
          receiver.error(emission.error); // Call `error` if emission failed
        } else {
          currentValue = emission.value;
          const timestamp = emission.root().timestamp;
          if (receiver.next && subscription.subscribed <= timestamp && ((subscription.unsubscribed && subscription.unsubscribed >= timestamp) || !subscription.unsubscribed)) {
            receiver.next(emission.value);
          }
        }
      } catch (err) {
        console.error('Error in Receiver callback:', err);
      }

      return Promise.resolve();
    };
;

    // Add the bound callback to the subscribers
    emitter.on('subscribers', boundCallback);

    return subscription;
  };

  const stream = subscribe as unknown as Stream;

  Object.defineProperty(stream, 'name', { writable: true, enumerable: true, configurable: true });
  Object.assign(stream, {
    type: "stream" as "stream",
    name,
    subscribe,
    pipe,
    chain,
    compose,
    run,
    next,
    error,
    emit,
    awaitCompletion,
    shouldComplete,
    complete,
    emitter,
    emissionCounter,
    stopTimestamp,
    startTimestamp,
    get value() {
      return currentValue;
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
  });

  emitter.on('emission', (params) => stream.emit(params));
  return stream; // Return the stream instance
}
