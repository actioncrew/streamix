import { createOperator, StreamResult } from "../abstractions";
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
  createOperator<T, T>("last", (source) => {
    let lastValue: T | undefined = undefined;
    let hasMatch = false;
    let finished = false;

    return {
      async next(): Promise<StreamResult<T>> {
        while (true) {
          if (finished) return { done: true, value: undefined };

          const result = await source.next();

          if (result.done) {
            finished = true;
            if (!hasMatch) throw new Error("No elements in sequence");
            return { done: false, value: lastValue! }; // emit final value normally
          }

          if (result.phantom) continue;

          const value = result.value;
          const matches = !predicate || (await predicate(value));

          if (matches) {
            if (hasMatch) {
              // Previous last value becomes phantom
              const phantom = lastValue!;
              lastValue = value;
              return { done: false, value: phantom, phantom: true };
            } else {
              lastValue = value;
              hasMatch = true;
              continue; // first match, wait for next to decide phantom
            }
          } else {
            // Non-matching values are phantoms
            return { done: false, value, phantom: true };
          }
        }
      }
    };
  });
