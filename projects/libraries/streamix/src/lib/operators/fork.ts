import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator, Stream } from "../abstractions";
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

export interface ForkOption<T = any, R = any> {
  on: (value: T, index: number) => CallbackReturnType<boolean>;
  handler: (value: T) => Stream<R> | CallbackReturnType<R> | Array<R>;
}

export const fork = <T = any, R = any>(options: ForkOption<T, R>[]) =>
  createOperator<T, R>("fork", function (this: Operator, source, context) {
    let outerIndex = 0;
    let innerIter: AsyncIterator<R> | null = null;
    let innerSc: any | null = null;
    let pendingOuter: T | undefined;
    let innerHadEmissions = false;

    const closeInner = async () => {
      try { await innerSc?.finalize?.(); } catch {}
      innerSc = null;
      innerIter = null;
    };

    return {
      next: async () => {
        while (true) {
          // If no active inner, pull next outer and create one
          if (!innerIter) {
            const outerRes = await source.next(); // REMOVED createStreamResult wrapper
            if (outerRes.done) return DONE;

            pendingOuter = outerRes.value;
            innerHadEmissions = false;

            // Find the first matching option
            const idx = outerIndex;
            let matched: ForkOption<T, R> | undefined;
            for (const opt of options) {
              if (await opt.on(pendingOuter!, idx)) { matched = opt; break; }
            }
            if (!matched) {
              throw new Error(`No handler found for value: ${pendingOuter}`);
            }

            const innerStream = fromAny(matched.handler(pendingOuter!));
            innerSc = context?.pipeline.registerStream(innerStream);
            innerIter = eachValueFrom(innerStream);

            outerIndex++;
          }

          // Consume the active inner
          let innerRes: IteratorResult<R>;
          try {
            innerRes = await innerIter.next();
          } catch (err) {
            await closeInner();
            throw err;
          }

          if (innerRes.done) {
            // CORRECT: Use proper phantom handling for empty inner streams
            if (!innerHadEmissions && innerSc) {
              const phantomResult = createStreamResult({
                value: pendingOuter,
                type: 'phantom',
                done: true
              });
              innerSc.markPhantom(this, phantomResult);
            }
            await closeInner();
            continue;
          }

          // Emit normal value
          innerHadEmissions = true;
          innerSc?.logFlow?.("emitted", this, innerRes.value, "Inner stream emitted");
          return NEXT(innerRes.value);
        }
      }
    };
  });
