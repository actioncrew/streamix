import { createEmission, createStream, Emission, flags, hooks, internals, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Emission;
  complete(): Promise<void>;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {

  const stream = createStream<T>(async function (this: any): Promise<void> {
    await started;
    await stream[internals].awaitCompletion();
  }) as any;

  stream.complete = stream.complete;

  stream.next = function (this: Stream, value?: T): Emission {
    const emission = createEmission({ value });

    // If the stream is stopped, further emissions are not allowed
    if (this[flags].isStopRequested || this[flags].isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return emission;
    }

    started.then(() => {

      eventBus.enqueue({
        target: this,
        payload: { emission, source: this },
        type: 'emission',
      });
    });

    return emission;
  };

  let started = stream[hooks].onStart.waitForCompletion();

  stream.name = "subject";
  return stream;
}
