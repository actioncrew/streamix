import { CallbackReturnType, createOperator, createStreamContext, createStreamResult, Operator, Stream } from "../abstractions";
import { eachValueFrom, fromAny } from '../converters';
import { createSubject, Subject } from "../streams";

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
  createOperator<T, R>("fork", function (this: Operator, source, context) {
    // Use a Subject for the output stream, mirroring the concatMap pattern
    const output: Subject<R> = createSubject<R>();
    const sc = context?.currentStreamContext();

    let outerIndex = 0;
    let outerCompleted = false;
    let errorOccurred = false;
    let currentInnerCompleted = true;
    let pendingValues: T[] = [];

    // This async function processes a single inner stream at a time
    const processNextInner = async () => {
      // Don't proceed if there are no pending values or an inner stream is already processing
      if (pendingValues.length === 0 || !currentInnerCompleted) return;

      currentInnerCompleted = false;
      const outerValue = pendingValues.shift()!;
      let matchedOption: typeof options[number] | undefined;

      try {
        // Find the first matching handler by checking each predicate
        for (const option of options) {
          if (await option.on(outerValue, outerIndex++)) {
            matchedOption = option;
            break;
          }
        }

        if (!matchedOption) {
          throw new Error(`No handler found for value: ${outerValue}`);
        }

        // Create the inner stream from the matched handler's result
        const innerStream = fromAny(matchedOption.handler(outerValue));
        const innerSc = context && createStreamContext(context, innerStream);
        let innerHadEmissions = false;

        // Consume the inner stream using a for await...of loop,
        // which ensures sequential processing.
        for await (const val of eachValueFrom(innerStream)) {
          if (errorOccurred) break;

          output.next(val);
          innerHadEmissions = true;

          // Log emissions from the inner stream
          innerSc?.logFlow('emitted', null as any, val, 'Inner stream emitted from fork handler');
        }

        // Handle the "phantom" value for inner streams that complete with no emissions
        if (!innerHadEmissions && !errorOccurred) {
          await innerSc?.phantomHandler(null as any, outerValue);
        }

      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      } finally {
        currentInnerCompleted = true;

        // If there are more pending values, process the next one
        if (pendingValues.length > 0) {
          processNextInner();
        } else if (outerCompleted && !errorOccurred) {
          // If the outer stream is complete and the queue is empty, complete the output stream
          output.complete();
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

          // Push the received value to the pending queue
          pendingValues.push(result.value);

          // Log the outer value reception
          sc?.logFlow('emitted', this, result.value, 'Outer value received');

          // If no inner stream is currently active, start processing the queue
          if (currentInnerCompleted) {
            processNextInner();
          }
        }

        outerCompleted = true;

        // Final check to complete the output stream if all processing is done
        if (pendingValues.length === 0 && currentInnerCompleted && !errorOccurred) {
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
