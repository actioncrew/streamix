import { CallbackReturnType, COMPLETE, createOperator, NEXT, Stream } from "../abstractions";
import { eachValueFrom, fromAny } from "../converters";
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that maps each value from the source stream to a new
 * inner stream (or value/array/promise) and flattens all inner streams sequentially.
 *
 * For each value from the source:
 * 1. The `project` function is called with the value and its index.
 * 2. The returned value is normalized into a stream using {@link fromAny}.
 * 3. The inner stream is consumed fully before processing the next outer value.
 *
 * This ensures that all emitted values maintain their original sequential order.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the inner streams and the output.
 * @param project A function that takes a value from the source stream and its index,
 * and returns either:
 *   - a {@link Stream<R>},
 *   - a {@link CallbackReturnType<R>} (value or promise),
 *   - or an array of `R`.
 * @returns An {@link Operator} instance that can be used in a stream's `pipe` method.
 */
export const concatMap = <T = any, R = T>(
  project: (value: T, index: number) => Stream<R> | CallbackReturnType<R> | Array<R>
) =>
  createOperator<T, R>("concatMap", (source, context) => {
    let outerIndex = 0;
    let innerIterator: AsyncIterator<R> | null = null;
    let result: StreamResult<T> | null = null;
    let innerHadEmissions = false;

    return {
      async next(): Promise<StreamResult<R>> {
        while (true) {
          // If no active inner iterator, pull the next outer value
          if (!innerIterator) {
            result = await source.next();

            if (result.done) return COMPLETE;

            // Initialize inner stream
            innerHadEmissions = false;
            innerIterator = eachValueFrom<R>(
              fromAny(project(result.value, outerIndex++))
            );
          }

          // Pull next value from inner stream
          const innerResult = await innerIterator.next();

          if (innerResult.done) {
            innerIterator = null;

            // If inner stream emitted nothing, produce a phantom
            if (!innerHadEmissions && result !== null) {
              context.phantomHandler(result.value);
            }

            // Otherwise continue to next outer value
            continue;
          }

          // Mark that inner stream produced a value
          innerHadEmissions = true;
          return NEXT(innerResult.value);
        }
      },
    };
  });
