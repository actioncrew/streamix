import { createEmission, createStream, Emission, Stream, Subscription } from '../abstractions';
import { eventBus } from '../abstractions';
import { promisified } from '../utils';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Emission;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {
  let started = false;
  let autoComplete = false;
  let stopRequested = false;
  let currentValue: T | undefined;

  const commencement = promisified<void>();
  const completion = promisified<void>();

  let stream = createStream<T>(async () => Promise.resolve()) as Subject;
  let lock = Promise.resolve();

  Object.defineProperty(stream, "isAutoComplete", {
    get() {
      return autoComplete;
    },
    set(value: boolean) {
      if (value) {
        if(!stream.isAutoComplete && !stream.isStopRequested) {
          lock = lock.then(async () => {
            eventBus.enqueue({ target: stream, type: 'complete' });
            await stream.onComplete.waitForCompletion();
            eventBus.enqueue({ target: stream, type: 'stop' });
          })
        }
        lock = lock.then(() => {
          completion.resolve();
        });
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
        if(!stream.isAutoComplete && !stream.isStopRequested) {
          lock = lock.then(async () => {
            eventBus.enqueue({ target: stream, type: 'complete' });
            await stream.onComplete.waitForCompletion();
            eventBus.enqueue({ target: stream, type: 'stop' });
          })
        }
        lock = lock.then(() => {
          completion.resolve();
        });
      }
      stopRequested = value;
    },
    configurable: true
  });

  stream.run = async () => Promise.resolve();

  stream.awaitCompletion = () => completion.promise();

  stream.next = function(this: Subject, value?: T): Emission {
    const emission = createEmission({ value });

    if (this.isStopRequested || this.isStopped) {
      console.warn("Cannot push value to a stopped Subject.");
      return emission;
    }

    if(!started) {
      started = true;
      lock = lock.then(async () => {
        eventBus.enqueue({ target: this, type: 'start' });
        await this.onStart.waitForCompletion();
        commencement.resolve();
      })
    }

    this.emissionCounter++;

    lock = lock.then(() => {
      eventBus.enqueue({
        target: this,
        payload: { emission, source: this },
        type: 'emission'
      });
    });

    return emission;
  };

  stream.subscribe =function (this: Subject, callback?: (value: T) => void): Subscription {
    const boundCallback = ({ emission, source }: any) => {
      currentValue = emission.value;
      return callback ? Promise.resolve(callback(emission.value)) : Promise.resolve();
    };

    this.subscribers.chain(boundCallback);

    if (!this.isRunning && !this.isStopRequested) {
      this.isRunning = true;
    }

    const subscription: Subscription = () => currentValue;
    subscription.unsubscribed = false;

    subscription.unsubscribe = () => {
      if(!subscription.unsubscribed) {
        subscription.unsubscribed = true;
        stream.complete().then(() => this.subscribers.remove(boundCallback));
      }
    };

    subscription.started = commencement.promise();
    subscription.completed = completion.promise();

    return subscription as Subscription;
  };

  stream.complete = async (): Promise<void> => {
    if(!stream.isStopped && !stream.isStopRequested) {
      stream.isStopRequested = true;
      lock = lock.then(async () => {
        await stream.onStop.waitForCompletion();
        stream.isStopped = true; stream.isRunning = false;
        stream.operators.forEach(operator => operator.cleanup());
      });
    }

    return lock;
  };

  stream.name = "subject";
  return stream;
}
