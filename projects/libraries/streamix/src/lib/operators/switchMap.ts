import { CallbackReturnType, createOperator, createStreamContext, createStreamResult, Operator, Stream } from "../abstractions";
import { eachValueFrom, fromAny } from '../converters';
import { createSubject, Subject } from "../streams";

/**
 * Creates a stream operator that maps each value from the source stream to a new inner stream
 * and "switches" to emitting values from the most recent inner stream, canceling the previous one.
 *
 * For each value from the source:
 * 1. The `project` function is called with the value and its index.
 * 2. The returned value is normalized into a stream using {@link fromAny}.
 * 3. The operator switches to the new inner stream, cancelling any previous active inner stream.
 * 4. Only values from the latest inner stream are emitted.
 *
 * This operator is useful for scenarios such as:
 * - Type-ahead search where only the latest query results are relevant.
 * - Handling user events where new events invalidate previous operations.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the inner and output streams.
 * @param project A function that maps a source value and its index to either:
 * - a {@link Stream<R>},
 * - a {@link CallbackReturnType<R>} (value or promise),
 * - or an array of `R`.
 * @returns An {@link Operator} instance suitable for use in a stream's `pipe` method.
 */
export function switchMap<T = any, R = any>(
  project: (value: T, index: number) => Stream<R> | CallbackReturnType<R> | Array<R>
) {
  return createOperator<T, R>("switchMap", function (this: Operator, source, context) {
    // Use a Subject for the output stream, consistent with the concatMap pattern
    const output: Subject<R> = createSubject<R>();
    const sc = context?.currentStreamContext();

    let outerCompleted = false;
    let errorOccurred = false;
    let outerIndex = 0;

    // Use a unique ID to track the most recent inner stream
    let currentInnerStreamId = 0;

    // This async function processes a single inner stream
    const processInner = async (outerValue: T, id: number) => {
      let innerHadEmissions = false;
      const innerStream = fromAny(project(outerValue, outerIndex++));
      const innerSc = context && createStreamContext(context, innerStream);

      try {
        // Iterate over the inner stream and emit values
        for await (const val of eachValueFrom(innerStream)) {
          // If a new outer value has arrived, this inner stream is no longer the latest.
          // Break the loop to "switch" to the new stream.
          if (id !== currentInnerStreamId) {
            innerSc?.logFlow('emitted', this, val, 'Inner stream canceled due to new stream');
            break;
          }
          if (errorOccurred) break;

          output.next(val);
          innerHadEmissions = true;
          innerSc?.logFlow('emitted', null as any, val, 'Inner stream emitted from switchMap handler');
        }

        // Handle "phantom" value for inner streams that complete with no emissions
        if (!innerHadEmissions && id === currentInnerStreamId && !errorOccurred) {
          await innerSc?.phantomHandler(null as any, outerValue);
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      }
    };

    // This immediately-invoked async function handles the outer stream
    (async () => {
      try {
        // Loop to pull values from the source stream
        while (true) {
          const result = createStreamResult(await source.next());
          if (result.done) break;
          if (errorOccurred) break;

          sc?.logFlow('emitted', this, result.value, 'Outer value received');

          // Increment the ID to identify the new latest stream
          const newId = ++currentInnerStreamId;

          // Immediately start processing the new inner stream
          processInner(result.value, newId);
        }

        outerCompleted = true;

        // Final check to complete the output stream if all processing is done
        if (outerCompleted && !errorOccurred) {
          output.complete();
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      }
    })();

    // Return the output stream, which will be consumed by the next operator in the pipeline
    return eachValueFrom<R>(output);
  });
}
