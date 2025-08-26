import { CallbackReturnType, createOperator, createStreamContext, createStreamResult, DONE, NEXT, Operator, Stream } from "../abstractions";
import { eachValueFrom, fromAny } from '../converters';

/**
 * Represents a conditional branch for the `fork` operator.
 *
 * Each `ForkOption` defines:
 * 1. A predicate function `on` to test source values.
 * 2. A handler function `handler` that produces a stream (or value/array/promise) when the predicate matches.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the handler and output stream.
 */
export interface ForkOption<T = any, R = any> {
  /**
   * Predicate function to determine if this option should handle a value.
   *
   * @param value The value from the source stream.
   * @param index The zero-based index of the value in the source stream.
   * @returns A boolean or a `Promise<boolean>` indicating whether this option matches.
   */
  on: (value: T, index: number) => CallbackReturnType<boolean>;

  /**
   * Handler function called for values that match the predicate.
   *
   * Can return:
   * - a {@link Stream<R>}
   * - a {@link CallbackReturnType<R>} (value or promise)
   * - an array of `R`
   *
   * @param value The source value that matched the predicate.
   * @returns A stream, value, promise, or array to be flattened and emitted.
   */
  handler: (value: T) => Stream<R> | CallbackReturnType<R> | Array<R>;
}

/**
 * Creates a stream operator that routes each source value through a specific handler
 * based on matching predicates defined in the provided `ForkOption`s.
 *
 * For each value from the source stream:
 * 1. Iterates over the `options` array.
 * 2. Executes the `on` predicate for each option until one returns `true`.
 * 3. Calls the corresponding `handler` for the first matching option.
 * 4. Flattens the result (stream, value, promise, or array) sequentially into the output stream.
 *
 * If no predicate matches a value, an error is thrown.
 *
 * This operator allows conditional branching in streams based on the content of each item.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the output stream.
 * @param options Array of {@link ForkOption} objects defining predicates and handlers.
 * @returns An {@link Operator} instance suitable for use in a stream's `pipe` method.
 *
 * @throws {Error} If a source value does not match any predicate.
 */
export const fork = <T = any, R = any>(options: ForkOption<T, R>[]) =>
  createOperator<T, R>('fork', function (this: Operator, source, context) {
    const sc = context?.currentStreamContext();
    let outerIndex = 0;
    let innerIterator: AsyncIterator<R> | null = null;
    let outerValue: T | undefined;
    let innerStreamHadEmissions = false;

    return {
      next: async () => {
        while (true) {
          // If no active inner iterator, get next outer value
          if (!innerIterator) {
            const result = createStreamResult(await source.next());
            if (result.done) {
              return DONE;
            }

            let matched: typeof options[number] | undefined;
            outerValue = result.value;
            innerStreamHadEmissions = false;

            for (const option of options) {
              if (await option.on(outerValue!, outerIndex++)) {
                matched = option;
                break;
              }
            }

            if (!matched) {
              throw new Error(`No handler found for value: ${outerValue}`);
            }

            const innerStream = fromAny(matched.handler(outerValue!));
            context && createStreamContext(context, innerStream);
            innerIterator = eachValueFrom(innerStream);
          }

          // Pull next inner value
          const innerResult = await innerIterator.next();
          if (innerResult.done) {
            innerIterator = null;
            // Now we can use the flag to determine if we should emit a phantom
            // or just continue. A phantom is only needed if the inner stream had
            // no emissions.
            if (!innerStreamHadEmissions) {
              // We return a phantom of the original outer value.
              await sc?.phantomHandler(this, outerValue);
            }
            // If the inner stream had emissions, we just continue the loop
            // to process the next outer value.
            continue;
          }

          // A value was emitted, so we know the inner stream is not empty.
          innerStreamHadEmissions = true;
          return NEXT(innerResult.value);
        }
      }
    };
  });
