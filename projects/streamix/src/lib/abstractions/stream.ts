import { createSubject } from "../../lib";
import { Emission, Operator, Receiver, StreamOperator, Subscribable, SubscribableHooks, SubscribableInternals, Subscription, createEmission, createReceiver, eventBus, flags, hooks, internals } from "../abstractions";
import { awaitable, hook } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  name?: string;
  emissionCounter: number;

  startTimestamp: number | undefined;
  stopTimestamp: number | undefined;

  run: () => Promise<void>;
  next: (emission: Emission) => Emission;
  error: (error: any) => void;

  compose: (...operators: StreamOperator[]) => Stream;
  chain: (...operators: Operator[]) => Stream;
  pipe: (...operators: (Operator | StreamOperator)[]) => Stream;

  [internals]: SubscribableInternals & {
    emit: (args: { emission: Emission; source: any }) => Promise<any>;
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
    await finalize.waitForCompletion();
    running = false;
    stopped = true;
    stream.stopTimestamp = performance.now();
  };

  const next = (emission: Emission): Emission => {
    eventBus.enqueue({ target: stream, payload: { emission, source: stream }, type: 'emission' })
    return emission;
  };

  const error = (error: Error): void => {
    eventBus.enqueue({ target: stream, payload: { error }, type: 'error' });
  };

  const awaitStart = () => commencement.promise();
  const awaitCompletion = () => completion.promise();

  const chain = function(this: Stream, ...operators: Operator[]): Stream {
    const output = createSubject();
    let pendingPromises: Promise<void>[] = []; // Array to store pending promises
    let isCompleteCalled = false; // Flag to handle the first complete call

    const subscription = this.subscribe({
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
            emission.failed = true;
            emission.error = error;
          }

          if (emission.failed) {
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

          if (emission.failed || emission.phantom && emission.pending) {
            break;
          }
        }

        if (!emission.failed && !emission.phantom) {
          const task = output.next(emission.value).wait();

          // Add the task to the Set of tasks
          pendingPromises.push(task);

          // Clean up task once it's completed
          task.finally(() => {
            pendingPromises.splice(pendingPromises.indexOf(task), 1);  // Remove completed task from the set
          });
        }
      },
      complete: () => {
        subscription.unsubscribe();

        if (!isCompleteCalled) {
          isCompleteCalled = true;

          // Complete immediately if no pending promises
          if (pendingPromises.length === 0) {
            output.complete();
          } else {
            // Wait for all pending promises to resolve before completing
            Promise.all(pendingPromises).then(() => {
              output.complete(); // Complete after all promises resolve
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
          combinedStream = combinedStream.chain(...operatorsGroup);
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
      combinedStream = combinedStream.chain(...operatorsGroup);
    }

    return combinedStream as Stream;
  };

  const emit = async function({ emission, source }: { emission: Emission; source: any }): Promise<any> {
    try {
      if (!emission.failed && !emission.phantom) {
        source.emissionCounter++;
        if(!emission.pending) {
          await subscribers.parallel({ emission, source });
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
      finalize.chain(receiver, completeCallback);
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
          if (receiver.complete) finalize.remove(receiver, completeCallback);
          if (receiver.error) onError.remove(receiver, errorCallback);
          subscribers.remove(boundCallback);
        };

        if (!stopped) {
          if(subscribers.length === 1) {
            stream[flags].isUnsubscribed = true;
          }
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

  const shouldComplete = () => autoComplete || unsubscribed;

  const stream = {
    type: "stream" as "stream",
    subscribe,
    pipe,
    chain,
    compose,
    run,
    next,
    error,
    complete,
    emissionCounter,
    stopTimestamp,
    startTimestamp,
    get value() {
      return currentValue;
    },

    [internals]: {
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
