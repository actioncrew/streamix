import { createStream, Stream } from '../../lib';
import { Subscription } from '../abstractions';

export interface Subject<T = any> extends Stream<T> {
  next(value?: T): Promise<void>;
}

export function createSubject<T = any>(): Subject<T> {
  let buffer: T[] = [];
  let processing = false;
  let emissionAvailable = Promise.resolve();

  async function run(): Promise<void> {
    if (buffer.length > 0) {
      await processBuffer();
    }
    await awaitCompletion();
    return emissionAvailable;
  }

  const subject = createStream<T>(run) as Subject<T>;
  const { awaitCompletion, isRunning, isStopped, isStopRequested, onEmission } = subject;

  async function processBuffer(): Promise<void> {
    while (buffer.length > 0) {
      const value = buffer.shift();
      await processEmission(value);
    }
  }

  async function enqueueEmission(value?: T): Promise<void> {
    if (processing) {
      emissionAvailable = emissionAvailable.then(() => processEmission(value));
    } else {
      await processEmission(value);
    }
  }

  async function processEmission(value?: T): Promise<void> {
    processing = true;

    try {
      await onEmission.process({ emission: { value }, source: subject });
    } finally {
      processing = false;
    }
  }

  subject.next = async (value?: T): Promise<void> => {
    if (isStopRequested || isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    if (!isRunning) {
      buffer.push(value!);
    } else {
      await enqueueEmission(value);
    }

    return emissionAvailable;
  };

  return subject;
}

// Create function for the BehaviorSubject
export function createBehaviorSubject<T = any>(initialValue: T): Subject<T> {
  const subject = createSubject<T>() as Subject<T>;
  let latestValue = initialValue;
  let hasEmittedInitialValue = false;

  // Override the next method to update the latest value and emit it
  const originalNext = subject.next.bind(subject); // Preserve the original next method

  subject.next = async (value?: T): Promise<void> => {
    latestValue = value!;  // Update the latest value
    await originalNext(value); // Call the original next method from Subject
  };

  // Ensure the latest value is emitted when a new subscriber subscribes
  subject.subscribe = (callback?: (value: T) => void): Subscription => {
    if (callback) {
      if (!hasEmittedInitialValue) {
        callback(latestValue);
        hasEmittedInitialValue = true;
      }
    }
    return subject.subscribe(callback); // Call the original subscribe method
  };

  return subject;
}
