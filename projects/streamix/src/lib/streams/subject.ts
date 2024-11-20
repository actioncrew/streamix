import { createEmission, createStream, Emission, Stream, Subscription } from '../abstractions';
import { eventBus } from '../abstractions';
import { promisified } from '../utils';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {
  let started = false;
  let autoComplete = false;
  let stopRequested = false;
  let currentValue: T | undefined;

  const commencement = promisified<void>();
  const completion = promisified<void>();
  const finalized = promisified<void>();

  let stream = createStream<T>(async () => Promise.resolve()) as Subject;

  Object.defineProperty(stream, "isAutoComplete", {
    get() {
      return autoComplete;
    },
    set(value: boolean) {
      if (value) completion.resolve();
      autoComplete = value;
    },
    configurable: true
  });

  Object.defineProperty(stream, "isStopRequested", {
    get() {
      return stopRequested;
    },
    set(value: boolean) {
      if (value) completion.resolve();
      stopRequested = value;
    },
    configurable: true
  });

  stream.run = async () => {
    if(!started) {
      started = true;
      eventBus.enqueue({ target: stream, type: 'start' });
    }

    await stream.onStart.waitForCompletion();
    commencement.resolve();

    await completion.promise();

    eventBus.enqueue({ target: stream, type: 'complete' });
    await stream.onComplete.waitForCompletion();
    eventBus.enqueue({ target: stream, type: 'stop' });

    return finalized.promise();
  };

  stream.next = async function(this: Subject, value?: T): Promise<void> {
    if (this.isStopRequested || this.isStopped) {
      console.warn("Cannot push value to a stopped Subject.");
      return;
    }

    if(!started) {
      started = true;

      eventBus.enqueue({ target: this, type: 'start' });
    }

    // Notify all subscribers
    const emission = createEmission({ value });

    eventBus.enqueue({
      target: this,
      payload: { emission, source: this },
      type: 'emission'
    });
  };

  stream.subscribe =function (this: Subject, callback?: (value: T) => void): Subscription {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    this.subscribers.chain(boundCallback);

    if (!this.isRunning && !this.isStopRequested) {
      this.isRunning = true;
      queueMicrotask(stream.run);
    }

    const subscription: Subscription = () => currentValue;
    subscription.unsubscribed = false;

    subscription.unsubscribe = () => {
      if(!subscription.unsubscribed) {
        stream.complete().then(() => this.subscribers.remove(boundCallback));
        subscription.unsubscribed = true;
      }
    };

    subscription.started = commencement.promise();
    subscription.completed = completion.promise();

    return subscription as Subscription;
  };

  stream.complete = async (): Promise<void> => {
    if(!stream.isRunning && !stream.isStopped) {
      await stream.onStart.waitForCompletion();
    }

    if(!stream.isStopped && !stream.isAutoComplete) {
      stream.isStopRequested = true;
      await finalized;
    }
  };

  stream.onStop.once(() => {
    stream.isStopped = true; stream.isRunning = false;
    stream.operators.forEach(operator => operator.cleanup());
    finalized.resolve()
  });

  stream.name = "subject";
  return stream;
}
