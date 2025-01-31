import {
  createEmission, createReceiver, createStream, createSubscription,
  Emission, eventBus, flags, Receiver, Stream, Subscription
} from '../abstractions';
import { awaitable } from '../utils';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Emission;
};

export function createSubject<T = any>(): Subject<T> {
  let currentValue: T | undefined;
  let autoComplete = false;
  let unsubscribed = false;

  const completion = awaitable<void>();

  const stream = createStream<T>('subject', async () => completion.promise()) as Subject;

  Object.defineProperties(stream, {
    value: {
      get: () => currentValue,
      enumerable: true,
      configurable: true
    }
  });

  Object.defineProperties(stream[flags], {
    isAutoComplete: {
      get: () => autoComplete,
      set: (value: boolean) => {
        if (value && stream[flags].isRunning && !stream.shouldComplete()) {
          autoComplete = true;
          completion.resolve();
          eventBus.enqueue({ target: stream, type: 'complete' });
        }
      },
      configurable: true
    },
    isUnsubscribed: {
      get: () => unsubscribed,
      set: (value: boolean) => {
        if (value && stream[flags].isRunning && !stream.shouldComplete()) {
          unsubscribed = true;
          completion.resolve();
          eventBus.enqueue({ target: stream, type: 'complete' });
        }
      },
      configurable: true
    }
  });

  stream.awaitCompletion = () => completion.promise();
  stream.shouldComplete = () => unsubscribed || autoComplete;

  stream.complete = async function (): Promise<void> {
    if (!this[flags].isRunning || this.shouldComplete()) return;
    autoComplete = true;
    completion.resolve();

    eventBus.enqueue({ target: this, type: 'complete' });
    await this.emitter.waitForCompletion('finalize');
  };

  stream.next = function (value?: any): Emission {
    if (this[flags].isUnsubscribed || this[flags].isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return createEmission({ value });
    }

    const emission = createEmission({ value });
    eventBus.enqueue({ target: this, payload: { emission, source: this }, type: 'emission' });
    return emission;
  };

  stream.subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);

    const subscription = createSubscription(
      () => currentValue,
      () => {
        if (!subscription.unsubscribed) {
          subscription.unsubscribed = performance.now();
          stream.complete().then(() => {
            if (receiver.complete) stream.emitter.off('finalize', receiver.complete);
            if (receiver.error) stream.emitter.off('error', receiver.error);
            stream.emitter.off('subscribers', boundCallback);
          });
        }
      }
    );

    const boundCallback = ({ emission }: any) => {

      try {
        if (emission.error) {
          receiver.error?.(emission.error);
        } else if (receiver.next) {
          currentValue = emission.value;
          const timestamp = emission.root().timestamp;
          if (receiver.next && subscription.subscribed <= timestamp && ((subscription.unsubscribed && subscription.unsubscribed >= timestamp) || !subscription.unsubscribed)) {
            receiver.next(emission.value);
          }
        }
      } catch (err) {
        console.error('Error in Receiver callback:', err);
      }
    };

    stream.emitter.on('subscribers', boundCallback);
    if (receiver.complete) stream.emitter.on('finalize', receiver.complete);
    if (receiver.error) stream.emitter.on('error', receiver.error);

    return subscription;
  };

  stream.emitter.once('finalize', () => {
    stream[flags].isStopped = true;
    stream[flags].isRunning = false;
  });

  stream[flags].isRunning = true;
  stream.startTimestamp = performance.now();
  eventBus.enqueue({ target: stream, type: 'start' });

  return stream;
}
