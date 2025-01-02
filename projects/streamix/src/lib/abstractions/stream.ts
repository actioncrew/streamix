import { createSubject } from "../../lib";
import { Emission, Operator, Receiver, StreamOperator, Subscribable, SubscribableHooks, SubscribableInternals, Subscription, createEmission, createReceiver, eventBus, flags, hooks, internals } from "../abstractions";
import { awaitable, hook } from "../utils";

export type Stream<T = any> = Subscribable<T> & {
  name?: string;
  operators: Operator[];
  emissionCounter: number;

  startTimestamp: number | undefined;
  stopTimestamp: number | undefined;

  run: () => Promise<void>;
  next: (emission: Emission) => Emission;
  error: (error: Error) => void;

  compose: (...operators: StreamOperator[]) => Stream;
  chain: (...operators: Operator[]) => Stream;
  pipe: (...operators: (Operator | StreamOperator)[]) => Stream;

  [internals]: SubscribableInternals & {
    head: Operator | undefined;
    tail: Operator | undefined;
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

  const next = (emission: Emission): Emission => {
    eventBus.enqueue({ target: stream, payload: { emission, source: stream }, type: 'emission' })
    return emission;
  };

  const error = (error: Error): void => {
    eventBus.enqueue({ target: stream, payload: { error }, type: 'error' });
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

  const chain = function(this: Stream, ...operators: Operator[]): Stream {
    const outputStream = createSubject();
    let pendingPromises: Promise<void>[] = []; // Array to store pending promises
    let isCompleteCalled = false; // Flag to handle the first complete call

    const subscription = this.subscribe({
      next: (value: any) => {
        let currentEmission = createEmission({ value });

        for (let i = 0; i < operators.length; i++) {
          const operator = operators[i];
          if (operator?.name === "catchError") {
            continue;
          }

          try {
            currentEmission = operator.handle(currentEmission, this);
          } catch (error) {
            currentEmission.failed = true;
            currentEmission.error = error;
          }

          if (currentEmission.failed) {
            let foundCatchError = false;
            for (let j = i + 1; j < operators.length; j++) {
              if (operators[j]?.name === "catchError") {
                foundCatchError = true;
                currentEmission = operators[j].handle(currentEmission, this);
                break;
              }
            }
            if (!foundCatchError) {
              throw currentEmission.error;
            }
          }

          if (currentEmission.failed || currentEmission.phantom) {
            break;
          }
        }

        if (!currentEmission.failed && !currentEmission.phantom) {
          const task = outputStream.next(currentEmission.value).wait();

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
            outputStream.complete();
          } else {
            // Wait for all pending promises to resolve before completing
            Promise.all(pendingPromises).then(() => {
              outputStream.complete(); // Complete after all promises resolve
            });
          }
        }
      }
    });

    return outputStream;
  };

  // Instance method for `compose`
  const compose = function(this: Stream, ...operators: StreamOperator[]): Stream {
    return operators.reduce((acc: Stream, operator: StreamOperator) => operator(acc), this) as Stream;
  };

  // Instance method for `pipe`
  const pipe = function(this: Stream, ...steps: (Operator | StreamOperator)[]): Stream {
    let combinedStream: Stream = this;
    let currentSimpleOperators: Operator[] = [];

    // Process each step in the pipeline
    for (const step of steps) {
      if ('handle' in step) {
        // If it's a SimpleOperator, add it to the current group
        currentSimpleOperators.push(step);
      } else if (typeof step === 'function') {
        // Apply any pending SimpleOperators first
        if (currentSimpleOperators.length > 0) {
          combinedStream = combinedStream.chain(...currentSimpleOperators);
          currentSimpleOperators = [];
        }

        // Apply the StreamOperator
        combinedStream = step(combinedStream);
      } else {
        throw new Error("Invalid step provided to pipe.");
      }
    }

    // Apply remaining SimpleOperators, if any
    if (currentSimpleOperators.length > 0) {
      combinedStream = combinedStream.chain(...currentSimpleOperators);
    }

    return combinedStream as Stream;
  };

  const emit = async function({ emission, source }: { emission: Emission; source: any }): Promise<any> {
    try {
      emission.timestamp = performance.now();

      if (!emission.failed && !emission.phantom && !emission.pending) {
        source.emissionCounter++;
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

  const shouldComplete = () => autoComplete || unsubscribed;

  const stream = {
    type: "stream" as "stream",
    operators,
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
      head,
      tail,
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
