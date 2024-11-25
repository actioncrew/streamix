import { cloneStream, createEmission, createStream, Emission, Stream, Subscription } from '../abstractions';
import { eventBus } from '../abstractions';
import { awaitable } from '../utils';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Emission;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {

  const stream = createStream<T>(async () => Promise.resolve()) as Subject;
  let currentValue: T | undefined;
  let autoComplete = false;
  let stopRequested = false;

  const commencement = awaitable<void>();
  const completion = awaitable<void>();

  stream.run = function(this: Subject<T>): Promise<void> {
    return Promise.resolve();
  };

  stream.complete = async function (this: Subject): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;

      eventBus.enqueue({
        target: this,
        type: 'complete'
      });

      eventBus.enqueue({
        target: this,
        type: 'stop'
      });

      completion.resolve();
    }
  };

  stream.next = function(this: Subject, value?: T): Emission {
    // If the stream is stopped, further emissions are not allowed
    const emission = createEmission({ value });

    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return emission;
    }

    if (!this.isRunning) {
      this.isRunning = true;
      eventBus.enqueue({
        target: this,
        type: 'start'
      });
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

  Object.defineProperty(stream, "isAutoComplete", {
    get() {
      return autoComplete;
    },
    set(value: boolean) {
      if (value) {
        if(stream.isRunning && !stream.isAutoComplete && !stream.isStopRequested) {
          eventBus.enqueue({ target: stream, type: 'complete' });
          eventBus.enqueue({ target: stream, type: 'stop' });
        }

        completion.resolve();
      }
      autoComplete = value;
    },
    configurable: true
  });

  Object.defineProperty(stream, "isStopRequested", {
    get() {
      return stopRequested;
    },
    set(value: boolean) {
      if (value) {
        if(stream.isRunning && !stream.isAutoComplete && !stream.isStopRequested) {
          eventBus.enqueue({ target: stream, type: 'complete' });
          eventBus.enqueue({ target: stream, type: 'stop' });
        }

        completion.resolve();
      }
      stopRequested = value;
    },
    configurable: true
  });

  stream.subscribe = function (callback?: ((value: any) => any)): Subscription {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    stream.subscribers.chain(boundCallback);

    if (!stream.isRunning && !stream.isStopRequested) {
      stream.isRunning = true;
      commencement.resolve();

      eventBus.enqueue({
        target: this,
        type: 'start'
      });
    }

    const subscription: Subscription = () => stream.value;
    subscription.unsubscribed = false;

    subscription.unsubscribe = () => {
      if(!subscription.unsubscribed) {

        stream.complete().then(() => stream.subscribers.remove(boundCallback));
        subscription.unsubscribed = true;
      }
    };

    subscription.started = Promise.resolve();
    subscription.completed = stream.awaitCompletion();

    return subscription as Subscription;
  }

  stream.name = "subject";
  stream.type = "subject";
  return stream;
}
