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

  stream.next = function (this: Stream, value?: T): Emission {
    const emission = createEmission({ value });

    // If the stream is stopped, further emissions are not allowed
    if (this[flags].isUnsubscribed || this[flags].isStopped) {
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

  let originalComplete = stream.complete;

  stream.complete = function () {
    return Promise.resolve().then(async () => {
      //if(!stream[flags].isRunning && !stream[flags].isStopped && !stream[flags].isUnsubscribed) {
        //await started.then(() => {
          if(stream[flags].isRunning && !stream[flags].isStopped) {
            eventBus.enqueue({ target: stream, type: 'complete' });
            stream[flags].isUnsubscribed = true;
            stream.stopTimestamp = performance.now();
          }
        //});
      //}
    })
  };

  let started = stream[hooks].onStart.waitForCompletion();

  stream.name = "subject";
  stream.type = "subject";
  return stream;
}
