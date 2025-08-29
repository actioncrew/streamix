import { CallbackReturnType, createOperator, createStreamResult, Operator, Stream } from '../abstractions';
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

    let index = 0;
    let activeInner = 0;
    let outerCompleted = false;
    let errorOccurred = false;

    const processInner = async (innerStream: Stream<R>, innerSc: any, outerValue: T) => {
      let innerHadEmissions = false;
      try {
        for await (const val of eachValueFrom(innerStream)) {
          if (errorOccurred) break;

          output.next(val);
          innerHadEmissions = true;

          // Log with inner stream's context
          innerSc?.logFlow('emitted', null as any, val, 'Inner stream emitted');
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
          innerSc?.logFlow('error', null as any, undefined, String(err));
        }
      } finally {
        activeInner--;

        // Phantom logging if no emissions
        if (!innerHadEmissions && !errorOccurred) {
          await innerSc?.phantomHandler(null as any, outerValue);
        }

        // unregister stream after it finishes
        context?.unregisterStream(innerSc);

        // Complete output when all inner streams are done
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

          const inner = fromAny(project(result.value, index++));
          const innerSc = context?.registerStream(inner);

          activeInner++;
          processInner(inner, innerSc, result.value);
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
