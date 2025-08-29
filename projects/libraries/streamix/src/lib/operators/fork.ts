import { CallbackReturnType, createOperator, createStreamResult, Operator, Stream } from "../abstractions";
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

import { StreamContext } from "../abstractions";
import { createSubject, Subject } from "../streams";

/**
 * ForkOption describes a conditional branch for the fork operator.
 */
export interface ForkOption<T = any, R = any> {
  on: (value: T, index: number) => CallbackReturnType<boolean>;
  handler: (value: T) => Stream<R> | CallbackReturnType<R> | Array<R>;
}

/**
 * Fork operator: routes each source value to the first matching handler,
 * flattens inner streams sequentially, and tracks phantom emissions.
 */
export const fork = <T = any, R = any>(options: ForkOption<T, R>[]) =>
  createOperator<T, R>("fork", function (this: Operator, source, context) {
    const output: Subject<R> = createSubject<R>();

    let index = 0;
    let outerCompleted = false;
    let errorOccurred = false;
    let currentInnerCompleted = true;
    let pendingValues: T[] = [];

    const processNextInner = async () => {
      if (pendingValues.length === 0 || !currentInnerCompleted) return;

      currentInnerCompleted = false;
      const outerValue = pendingValues.shift()!;
      let innerSc: StreamContext | undefined;
      let innerHadEmissions = false;

      try {
        // Find first matching ForkOption
        let matched: ForkOption<T, R> | undefined;
        for (const opt of options) {
          if (await opt.on(outerValue, index)) { matched = opt; break; }
        }
        if (!matched) throw new Error(`No handler found for value: ${outerValue}`);

        const innerStream = fromAny(matched.handler(outerValue));
        innerSc = context?.pipeline.registerStream(innerStream);

        for await (const val of eachValueFrom(innerStream)) {
          if (errorOccurred) break;

          innerHadEmissions = true;
          innerSc?.logFlow("emitted", this, val, "Inner stream emitted");
          output.next(val);
        }

        if (!innerHadEmissions && innerSc) {
          const phantomResult = createStreamResult({
            value: outerValue,
            type: "phantom",
            done: true
          });
          innerSc.markPhantom(this, phantomResult);
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
          innerSc?.logFlow("error", this, undefined, String(err));
        }
      } finally {
        if (innerSc) await context?.pipeline.unregisterStream(innerSc.streamId);

        currentInnerCompleted = true;

        if (pendingValues.length > 0) processNextInner();
        else if (outerCompleted && pendingValues.length === 0 && !errorOccurred) {
          output.complete();
        }
      }
    };

    (async () => {
      try {
        while (true) {
          const res = await source.next();
          if (res.done) break;
          if (errorOccurred) break;

          pendingValues.push(res.value);
          context?.logFlow("emitted", this, res.value, "Outer value received");

          if (currentInnerCompleted) processNextInner();
          index++;
        }

        outerCompleted = true;
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

    return eachValueFrom<R>(output);
  });
