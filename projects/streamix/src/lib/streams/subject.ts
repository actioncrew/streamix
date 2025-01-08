import { createEmission, createReceiver, createStream, Emission, eventBus, flags, internals, Receiver, Stream, Subscription } from '../abstractions';
import { awaitable } from '../utils';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Emission;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {

  const stream = createStream<T>('subject', async () => Promise.resolve()) as Subject;
  let currentValue: T | undefined;

  let autoComplete = false;
  let unsubscribed = false;

  const completion = awaitable<void>();

  stream.run = () => stream[internals].awaitCompletion();

  stream[internals].awaitCompletion = () => completion.promise();
  stream[internals].shouldComplete = () => unsubscribed || autoComplete;

  stream.complete = async function (this: Subject): Promise<void> {
    if (this[flags].isRunning && !this[internals].shouldComplete()) {
      autoComplete = true; completion.resolve();

      eventBus.enqueue({
        target: this,
        type: 'complete'
      });

      return this.emitter.waitForCompletion('finalize');
    }
  };

  stream.next = function(this: Subject, value?: any): Emission {
    // If the stream is stopped, further emissions are not allowed
    const emission = createEmission({ value });

    if (this[flags].isUnsubscribed || this[flags].isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return emission;
    }

    eventBus.enqueue({
      target: this,
      payload: { emission, source: this },
      type: 'emission',
    });

    return emission;
  };

  Object.defineProperty(stream, 'value', {
    get: function() {
      return currentValue;
    },
    enumerable: true,
    configurable: true
  });

  Object.defineProperty(stream[flags], "isAutoComplete", {
    get() {
      return autoComplete;
    },
    set(value: boolean) {
      if (value) {
        if(stream[flags].isRunning && !stream[internals].shouldComplete()) {
          autoComplete = value; completion.resolve();
          eventBus.enqueue({ target: stream, type: 'complete' });
        }
      }

    },
    configurable: true
  });

  Object.defineProperty(stream[flags], "isUnsubscribed", {
    get() {
      return unsubscribed;
    },
    set(value: boolean) {
      if (value) {
        if(stream[flags].isRunning && !stream[internals].shouldComplete()) {
          unsubscribed = value; completion.resolve();
          eventBus.enqueue({ target: stream, type: 'complete' });
        }
      }

    },
    configurable: true
  });

  stream.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    // Convert a callback into a Receiver if needed
    const receiver = createReceiver(callbackOrReceiver);
    const completeCallback = () => receiver.complete!();
    const errorCallback = ({ error }: any) => receiver.error!(error);

    // Chain the `complete` method to the `onStop` hook if present
    if (receiver.complete) {
      stream.emitter.on('finalize', completeCallback);
    }

    if (receiver.error) {
      stream.emitter.on('error', errorCallback);
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
          if (receiver.complete) stream.emitter.off('finalize', completeCallback);
          if (receiver.error) stream.emitter.off('error', errorCallback);
          stream.emitter.off('subscribers', boundCallback);
        };

        if (!stream[flags].isStopped) {
          stream.complete().then(cleanup);
        } else {
          cleanup();
        }
      }
    };

    // Add the bound callback to the subscribers
    stream.emitter.on('subscribers', boundCallback);

    return subscription as Subscription;
  };

  stream.emitter.once('finalize', () => {
    stream[flags].isStopped = true;
    stream[flags].isRunning = false;
  });

  stream[flags].isRunning = true;
  stream.startTimestamp = performance.now();
  eventBus.enqueue({ target: stream, type: 'start' });

  stream.type = 'subject';
  return stream;
}
