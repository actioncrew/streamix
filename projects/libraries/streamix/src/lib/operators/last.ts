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
    let finished = false;
    let consumed = false;
    let lastValue: T;
    let hasMatch = false;

    async function next(): Promise<StreamResult<T>> {
      // If we’ve already consumed and emitted, we’re done.
      if (finished && consumed) {
        return { value: undefined, done: true };
      }

      // If finished but not yet emitted the last value, emit it now.
      if (finished && !consumed) {
        consumed = true;
        return { value: lastValue, done: false };
      }

      // Otherwise, drain the source completely.
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;
          if (result.phantom) continue;

          const value = result.value;
          if (!predicate || (await predicate(value))) {
            lastValue = value;
            hasMatch = true;
          }
        }

        finished = true;

        if (!hasMatch) {
          throw new Error("No elements in sequence");
        }

        // Immediately return the last value, but mark it as not yet consumed.
        consumed = true;
        return { value: lastValue, done: false };
      } catch (err) {
        finished = true;
        throw err;
      }
    }

    return { next };
  });

