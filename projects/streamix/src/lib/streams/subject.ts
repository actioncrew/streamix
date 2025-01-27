import { Consumer, createEmission, createStream, Emission, eventBus, flags, internals, Receiver, Stream, Subscription } from '../abstractions';
import { awaitable } from '../utils';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Emission;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {

  const stream = createStream<T>('subject', async () => stream[internals].awaitCompletion()) as Subject;
  let currentValue: T | undefined;

  let autoComplete = false;
  let unsubscribed = false;

  const completion = awaitable<void>();

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
    // Convert a callback into a Consumer if needed
    const consumer: Consumer = {
      next: async (emission) => {
        if (!emission.error) {
          if (callbackOrReceiver && typeof callbackOrReceiver === 'function') {
            callbackOrReceiver(emission.value);
          } else if (callbackOrReceiver && typeof callbackOrReceiver.next === 'function') {
            callbackOrReceiver.next(emission.value);
          }
        } else {
          if (callbackOrReceiver && typeof callbackOrReceiver === 'object' && typeof callbackOrReceiver.error === 'function') {
            callbackOrReceiver.error(emission.error);
          }
        }
      },
      complete: () => {
        if (callbackOrReceiver && typeof callbackOrReceiver === 'object' && typeof callbackOrReceiver.complete === 'function') {
          callbackOrReceiver.complete();
        }
      },
    };

    return stream(consumer);
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
