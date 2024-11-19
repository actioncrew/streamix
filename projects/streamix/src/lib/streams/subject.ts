import { createEmission, createStream, Emission, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {
  const stream = createStream<T>(() => Promise.resolve()) as Subject;
  stream.run = () => Promise.resolve();
  
  stream.complete (this: Stream) => {
    this.isStopRequested = true;
    this.isRunning = false; this.isStopped = true;
  };
  
  stream.next = function (this: Stream, value?: T): Promise<void> {
    // If the stream is stopped, further emissions are not allowed
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }
    
    // Create and link the child emission
    const emission = createEmission({ value });

    // Enqueue the emission
    eventBus.enqueue({
      target: this,
      payload: { emission, source: this },
      type: 'emission',
    });

    return emission.wait();
  };
  
  stream.name = "subject";
  return stream;
}
