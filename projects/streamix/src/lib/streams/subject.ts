import { createStream, Stream } from '../abstractions';
import { eventBus } from './bus';

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
    // If the stream is stopped, further emissions are not allowed
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // if(started === undefined) {
    //   started = new Promise<void>((resolve) => {
    //     stream.onStart.once(() => resolve());
    //   });
    // }

    await started;

    promise = eventBus.enqueue({ target: this, payload: { emission: { value }, source: this }, type: 'emission' });
    await promise;
  };

  let started = new Promise<void>((resolve) => {
    stream.onStart.once(() => resolve());
  });

  stream.name = "subject";
  return stream;
}
