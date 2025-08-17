import { createOperator, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that maps each value from the source stream to an inner stream
 * and then merges all inner streams into a single output stream.
 *
 * This operator processes the inner streams concurrently. For each value from the source,
 * it calls the `project` function to create a new "inner" stream. It then subscribes
 * to this inner stream and immediately begins consuming values from it, without waiting
 * for other inner streams to complete. The output stream contains all values from all
 * inner streams, interleaved in the order they are produced.
 *
 * @template T The type of the values in the source stream.
 * @template R The type of the values in the inner and output streams.
 * @param project A function that takes a value from the source stream and returns a new stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function mergeMap<T = any, R = any>(
  project: (value: T, index: number) => Stream<R>,
) {
  return createOperator<T, R>('mergeMap', (source) => {
    const output = createSubject<R>();

    let index = 0;
    let activeInner = 0;
    let outerCompleted = false;
    let errorOccurred = false;

    // Process each inner stream concurrently
    const processInner = async (innerStream: Stream<R>) => {
      try {
        for await (const val of eachValueFrom(innerStream)) {
          if (errorOccurred) break;
          output.next(val);
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      } finally {
        activeInner--;
        if (outerCompleted && activeInner === 0 && !errorOccurred) {
          output.complete();
        }
      }
    };

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;
          if (errorOccurred) break;

          const inner = project(value, index++);
          activeInner++;
          processInner(inner); // concurrent, do not await
        }

        outerCompleted = true;
        if (activeInner === 0 && !errorOccurred) {
          output.complete();
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      }
    })();

    return eachValueFrom<R>(output);
  });
}
