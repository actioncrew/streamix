import { CallbackReturnType, createOperator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

/**
 * Represents a conditional branch for the `fork` operator.
 * @template T The type of the source stream values.
 * @template R The type of the output stream values.
 */
export interface ForkOption<T = any, R = any> {
  /**
   * The predicate function to test each source value.
   * @param value The value from the source stream.
   * @param index The zero-based index of the value.
   * @returns A boolean or Promise<boolean> indicating if this option matches the value.
   */
  on: (value: T, index: number) => CallbackReturnType<boolean>;
  /**
   * The handler function that returns a stream to process matching values.
   * @param value The value that matched the predicate.
   * @returns A Stream of values to be emitted.
   */
  handler: (value: T) => Stream<R>;
}

/**
 * Creates a stream operator that routes each value from the source stream
 * through a specific handler based on matching predicates.
 *
 * The operator is configured with an array of `ForkOption` objects. For each
 * value from the source, it iterates through these options and executes the
 * `handler` for the first `on` predicate that returns `true`. The output of
 * the handler (a new stream) is then flattened sequentially.
 *
 * This operator is useful for creating complex, conditional pipelines where
 * the processing logic depends on the nature of each individual data item.
 *
 * @template T The type of the values in the source stream.
 * @template R The type of the values in the output stream.
 * @param options An array of `ForkOption` objects, each containing a predicate
 * and a corresponding handler.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 * @throws {Error} Throws an error if a source value does not match any of the provided predicates.
 */
export const fork = <T = any, R = any>(options: ForkOption<T, R>[]) =>
  createOperator<T, R>('fork', (source) => {
    let outerIndex = 0;
    let innerIterator: AsyncIterator<R> | null = null;

    return {
      async next(): Promise<IteratorResult<R>> {
        while (true) {
          // If no active inner iterator, get next outer value
          if (!innerIterator) {
            const outerResult = await source.next();
            if (outerResult.done) {
              return { done: true, value: undefined };
            }

            let matched: typeof options[number] | undefined;

            for (const option of options) {
              if (await option.on(outerResult.value, outerIndex++)) {
                matched = option;
                break;
              }
            }

            if (!matched) {
              throw new Error(`No handler found for value: ${outerResult.value}`);
            }

            innerIterator = eachValueFrom(matched.handler(outerResult.value));
          }

          // Pull next inner value
          const innerResult = await innerIterator.next();
          if (innerResult.done) {
            innerIterator = null;
            continue; // Try next outer value
          }

          return { done: false, value: innerResult.value };
        }
      }
    };
  });
