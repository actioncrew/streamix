import { Consumer, createStream, Stream, Subscription } from '../abstractions';
import { Emission } from './../abstractions/emission';

export function concat<T = any>(...sources: Stream[]): Stream<T> {
  let subscription: Subscription | undefined;

  const stream = createStream<T>('concat', async function(this: Stream<T>, c: Consumer): Promise<void> {
    for (const source of sources) {
      await processSource(c, source);
    }
  });

  const processSource = async (c: Consumer, source: Stream): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      subscription = source({
        next: async (emission: Emission) => {
          c.next(emission);
          if (!emission.isOk()) {
            reject(emission.error);
          }
        },
        complete: () => {
          subscription?.unsubscribe();
          resolve(); // Proceed to the next source
        },
      });
    });
  };

  return stream;
}
