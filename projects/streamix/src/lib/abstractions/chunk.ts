import { createPipeline, createReceiver, eventBus, Pipeline, Receiver, Subscription } from '../abstractions';
import { awaitable, hook, Hook } from "../utils";
import { Emission } from "./emission";
import { isOperator, Operator } from "./operator";
import { isStream, Stream } from "./stream";
import { flags, hooks, internals, Subscribable, SubscribableFlags, SubscribableHooks, SubscribableInternals } from "./subscribable";

export type Chunk<T = any> = Subscribable & {
  name?: string;
  stream: Stream<T>
  operators: Operator[];

  [flags]: SubscribableFlags & {
    isPending: boolean;
  }

  [hooks]: SubscribableHooks & {
    finalize: Hook;
  };

  [internals]: SubscribableInternals & {
    bindOperators(...newOperators: Operator[]): void;
  }

  subscribe(callback?: ((value: T) => any) | Receiver): Subscription;
};

export function isChunk<T>(obj: any): obj is Stream<T> {
  return obj?.type === 'chunk';
}

// Creating a Chunk that handles operators
export function createChunk<T = any>(stream: Stream<T>): Chunk {
  let operators: Operator[] = [];

  const finalized = awaitable<void>();

  let running = false;
  let autoComplete = false;
  let unsubscribed = false;
  let stopped = false;
  let pending = false;

  const onStart = hook();
  const onComplete = hook();
  const onError = hook();
  const subscribers = hook();
  const finalize = hook();

  let currentValue: T | undefined;
  let emissionCounter = 0;

  let startTimestamp: number;
  let stopTimestamp: number;

  const bindOperators = (...newOperators: Operator[]): void => {
    operators.length = 0;
    let head: Operator | undefined = undefined;
    let tail: Operator | undefined = undefined;

    newOperators.forEach((operator, index) => {
      operators.push(operator.clone());
      if (!head) {
        head = operator;
      } else {
        tail!.next = operator;
      }
      tail = operator;
    });
  };

  const run = async function(this: Chunk<T>) {
    finalize.once(() => {
      stream[hooks].subscribers.remove(this, process);
      stopTimestamp = performance.now();
      operators.forEach(operator => operator.cleanup());
    });

    try {
      eventBus.enqueue({ target: this, type: 'start' });
      if(!stream[flags].isRunning) {
        stream[flags].isRunning = true;
        await stream.run.call(stream);
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { error }, type: 'error' });
    } finally {
      eventBus.enqueue({ target: this, type: 'complete' });
      !this[flags].isUnsubscribed && (this[flags].isAutoComplete = true);
    }
  };

  const complete = async function(this: Chunk<T>): Promise<void> {
    return Promise.resolve().then(async () => {
      if(!running && !stopped && !unsubscribed) {
        await onStart.waitForCompletion();
      }

      if (this.stream.type === 'subject') {
        this.stream.complete();
      }

      if(running && !stopped) {
        unsubscribed = true;
        stopTimestamp = performance.now();
      }

      await awaitCompletion();
    });
  };

  const process = async function(this: Chunk, { emission, source }: { emission: Emission; source: any }): Promise<any> {
    try {
      emission.timestamp = performance.now();

      let next = isStream(source) ? operators[0] : undefined;
      next = isOperator(source) ? source.next : next;

      if (emission.failed) throw emission.error;

      if (!emission.phantom && !emission.pending) {
        emission = next?.process(emission, this) ?? emission;
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
      return () => ({ target: this, payload: { error }, type: 'error' });
    }
  };

  const subscribe = function (this: Chunk<T>, callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription {
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

    // Create the subscription object
    const subscription: Subscription = () => currentValue;
    subscription.subscribed = performance.now();
    subscription.unsubscribed = undefined;

    // Define the bound callback for handling emissions
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;

      try {
        if (emission.failed && !onError.length) {
          receiver.error!(emission.error); // Call `error` if emission failed
        } else if (receiver.next && !emission.failed && ((subscription.unsubscribed && subscription.unsubscribed >= emission.root().timestamp) || (stopTimestamp || performance.now()) >= emission.root().timestamp)) {
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

        if (subscribers.length === 1) {
          stream[hooks].subscribers.remove(subscribers.parallel);
        }

        const cleanup = () => {
          if (receiver.complete) finalize.remove(receiver, receiver.complete);
          if (receiver.error) onError.remove(receiver, errorCallback);
          subscribers.remove(receiver, boundCallback);
        };

        if (!stopped) {
          this.complete().then(() => awaitCompletion()).then(cleanup);
        } else {
          cleanup();
        }
      }
    };

    subscription.started = awaitStart();
    subscription.completed = awaitCompletion();

    if (!subscribers.length) {
      stream[hooks].subscribers.chain(subscribers.parallel);
    }

    // Start the stream if it isn't running and stopping hasn't been requested
    if (!running && !unsubscribed) {
      running = true;
      startTimestamp = performance.now();
      queueMicrotask(() => run.call(this));
    }

    // Add the bound callback to the subscribers
    subscribers.chain(receiver, boundCallback);

    return subscription as Subscription;
  };

  const awaitStart = () => stream[internals].awaitStart();
  const awaitCompletion = () => Promise.all([stream[internals].awaitCompletion(), finalized.promise()]).then(() => Promise.resolve());
  const shouldComplete = () => unsubscribed;

  const pipe = function(this: Chunk, ...operators: Operator[]): Pipeline<T> {
    return createPipeline<T>(this)[internals].bindOperators(...operators);
  };

  let chunk = {
    type: "chunk" as "chunk",
    name: stream.name,
    stream,
    operators,
    subscribe,
    pipe,
    complete,
    emissionCounter,
    get value() {
      return currentValue;
    },

    [internals]: {
      awaitStart,
      awaitCompletion,
      shouldComplete,
      bindOperators
    },

    [flags]: {
      get isAutoComplete() {
        autoComplete = stream[flags].isAutoComplete && stopped;
        return autoComplete;
      },
      set isAutoComplete(value: boolean) {
        autoComplete = value;
      },
      get isUnsubscribed() {
        return unsubscribed;
      },
      set isUnsubscribed(value: boolean) {
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
        value && finalized.resolve();
        stopped = value;
      },
      get isPending() {
        return pending;
      },
      set isPending(value: boolean) {
        pending = value;
      }
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
      },
      get finalize() {
        return finalize;
      }
    },
  };

  bindOperators(...operators);
  stream[hooks].subscribers.chain(chunk, process);

  return chunk;
}
