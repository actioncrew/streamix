import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";
import { CallbackReturnType } from "./../abstractions/receiver";

/**
 * Creates a stream operator that emits only the last value from the source stream
 * that matches an optional predicate.
 *
 * This operator must consume the entire source stream to find the last matching
 * value. It caches the last value that satisfies the `predicate` (or the last
 * value of the stream if no predicate is provided) and emits it only when the
 * source stream completes.
 *
 * @template T The type of the values in the source stream.
 * @param predicate An optional function to test each value. It receives the value
 * and should return `true` to indicate a match.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 * @throws {Error} Throws an error with the message "No elements in sequence" if no
 * matching value is found before the source stream completes.
 */

export const last = <T = any>(
  predicate?: (value: T) => CallbackReturnType<boolean>
) =>
  createOperator<T, T>("last", function (this: Operator, source, context) {

    let lastValue: T | undefined = undefined;
    let hasMatch = false;
    let finished = false;

    return {
      next: async () => {
        while (true) {
          if (finished) return DONE;

          const result = await source.next(); // REMOVED createStreamResult wrapper

          if (result.done) {
            finished = true;
            if (!hasMatch) throw new Error("No elements in sequence");
            return NEXT(lastValue!);
          }

          const value = result.value;
          const matches = !predicate || (await predicate(value));

          if (matches) {
            if (hasMatch) {
              // Previous last value becomes phantom - use proper phantom handling
              const phantomValue = lastValue!;
              lastValue = value;

              if (context) {
                const phantomResult = createStreamResult({
                  value: phantomValue,
                  type: 'phantom',
                  done: true
                });
                context.markPhantom(this, phantomResult);
              }
              continue;
            } else {
              lastValue = value;
              hasMatch = true;
              continue;
            }
          } else {
            // Non-matching values are phantoms - use proper phantom handling
            if (context) {
              const phantomResult = createStreamResult({
                value: value,
                type: 'phantom',
                done: true
              });
              context.markPhantom(this, phantomResult);
            }
          }
        }
      }
    };
  });
