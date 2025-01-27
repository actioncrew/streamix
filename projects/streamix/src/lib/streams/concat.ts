import { createEmission, createStream, Stream, Subscription } from '../abstractions';
import { Emission } from './../abstractions/emission';

export function concat<T = any>(...sources: Stream[]): Stream<T> {
  let activeSubscription: Subscription | undefined;

  const stream = createStream<T>('concat', async function(this: Stream<T>): Promise<void> {
    for (const source of sources) {
      await processSource(this, source);
    }
  });

  const processSource = async (stream: Stream<T>, source: Stream): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      activeSubscription = source({
        next: async (emission: Emission) => {
          if (!emission.error) {
            emitValue(stream, emission.value);
          } else {
            emitError(stream, emission.error);
            reject(emission.error);
          }
        },
        complete: () => {
          activeSubscription?.unsubscribe();
          resolve(); // Proceed to the next source
        },
      });
    });
  };

  const emitValue = (stream: Stream<T>, value: T) => {
    stream.next(createEmission({ value }));
  };

  const emitError = (stream: Stream<T>, error: any) => {
    stream.error(error);
  };

  return stream;
}
