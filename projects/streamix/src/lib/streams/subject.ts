import { createEmission, createStream, Emission, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {

  const stream = createStream<T>(async function (this: any): Promise<void> {
    await started;
    await this.awaitCompletion();
  }) as any;

  stream.next = function (this: Stream, value?: T): Promise<void> {
    // If the stream is stopped, further emissions are not allowed
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    return started
      .then(() => {
        running = true; // Mark the stream as running

        const emission = createEmission({ value });

        eventBus.enqueue({
          target: this,
          payload: { emission, source: this },
          type: 'emission',
        });

        return emission.wait();
      });
  };


  let started = stream.onStart.waitForCompletion();
  let running = false;

  stream.name = "subject";
  return stream;
}
