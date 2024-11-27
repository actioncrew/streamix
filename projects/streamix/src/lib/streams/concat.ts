import { createEmission, createStream, hooks, Stream, Subscribable, Subscription } from '../abstractions';
import { eventBus } from '../abstractions';

export function concat<T = any>(...sources: Subscribable[]): Stream<T> {
  let activeSubscription: Subscription | undefined;

  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    for (const source of sources) {
      await processSource(this, source);
    }
  });

  const processSource = async (stream: Stream<T>, source: Subscribable): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      activeSubscription = source.subscribe({
        next: (value) => emitValue(stream, value),
        error: (err) => {
          emitError(stream, err);
          reject(err); // Terminate the processing chain
        },
        complete: () => {
          activeSubscription?.unsubscribe();
          resolve(); // Proceed to the next source
        },
      });
    });
  };

  const emitValue = (stream: Stream<T>, value: T) => {
    const emission = createEmission({ value });
    eventBus.enqueue({ target: stream, payload: { emission, source: stream }, type: 'emission' });
  };

  const emitError = (stream: Stream<T>, error: any) => {
    const emission = createEmission({ error, failed: true });
    eventBus.enqueue({ target: stream, payload: { emission, source: stream }, type: 'emission' });
  };

  stream.name = "concat";
  return stream;
}
