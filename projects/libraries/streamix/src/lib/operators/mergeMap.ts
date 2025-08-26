import { CallbackReturnType, createOperator, createStreamContext, createStreamResult, Operator, Stream } from '../abstractions';
import { eachValueFrom, fromAny } from '../converters';
import { createSubject, Subject } from '../streams';

/**
 * Creates a stream operator that maps each value from the source stream to an "inner" stream
 * and merges all inner streams concurrently into a single output stream.
 *
 * For each value from the source stream:
 * 1. The `project` function is called with the value and its index.
 * 2. The returned value is normalized into a stream using {@link fromAny}.
 * 3. The inner stream is consumed concurrently with all other active inner streams.
 * 4. Emitted values from all inner streams are interleaved into the output stream
 *    in the order they are produced, without waiting for other inner streams to complete.
 *
 * This operator is useful for performing parallel asynchronous operations while
 * preserving all emitted values in a merged output.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the inner and output streams.
 * @param project A function that maps a source value and its index to either:
 *   - a {@link Stream<R>},
 *   - a {@link CallbackReturnType<R>} (value or promise),
 *   - or an array of `R`.
 * @returns An {@link Operator} instance that can be used in a stream's `pipe` method.
 */
export function mergeMap<T = any, R = any>(
  project: (value: T, index: number) => Stream<R> | CallbackReturnType<R> | Array<R>,
) {
  return createOperator<T, R>('mergeMap', function (this: Operator, source, context) {
    const output: Subject<R> = createSubject<R>();
    const sc = context?.currentStreamContext();

    let index = 0;
    let activeInner = 0;
    let outerCompleted = false;
    let errorOccurred = false;

    // Process each inner stream concurrently.
    const processInner = async (innerStream: Stream<R>, outerValue: T) => {
      let innerStreamHadEmissions = false;
      try {
        for await (const val of eachValueFrom(innerStream)) {
          if (errorOccurred) break;
          output.next(val);
          innerStreamHadEmissions = true;
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      } finally {
        activeInner--;
        // If the inner stream had no emissions, signal a phantom.
        if (!innerStreamHadEmissions && !errorOccurred) {
          await sc?.phantomHandler(this, outerValue);
        }
        if (outerCompleted && activeInner === 0 && !errorOccurred) {
          output.complete();
        }
      }
    };

    (async () => {
      try {
        while (true) {
          const result = createStreamResult(await source.next());
          if (result.done) break;
          if (errorOccurred) break;

          const innerStream = fromAny(project(result.value, index++));
          context && createStreamContext(context, innerStream);

          activeInner++;
          processInner(innerStream, result.value); // Pass outerValue
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
