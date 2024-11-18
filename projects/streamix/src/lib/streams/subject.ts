import { createEmission, createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {
  let promise: Promise<void> | undefined;
  let lastPromise: Promise<void> | undefined;

  const stream = createStream<T>(async function (this: any): Promise<void> {
    await started;
    await this.awaitCompletion();
    do {
      lastPromise = promise;
      await lastPromise;
    } while(lastPromise !== promise);
  }) as any;

  stream.next = async function (this: Stream, value?: T): Promise<void> {
    const releaseLock = await this.lock.acquire();
    try {
      // If the stream is stopped, further emissions are not allowed
      if (this.isStopRequested || this.isStopped) {
        console.warn('Cannot push value to a stopped Subject.');
        return Promise.resolve();
      }

      await started;

      eventBus.enqueue({ target: this, payload: { emission: createEmission({ value }), source: this }, type: 'emission' });
    } finally {
      releaseLock();
    }
  };

  let started = stream.onStart.waitForCompletion();

  stream.name = "subject";
  return stream;
}
