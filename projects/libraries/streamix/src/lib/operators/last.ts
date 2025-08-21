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
export const last = <T = any>(predicate?: (value: T) => CallbackReturnType<boolean>) =>
  createOperator<T, T>("last", (source) => {
    let finished = false;
    let emitted = false;
    let lastValue: T | undefined;
    let hasMatch = false;

    async function next(): Promise<StreamResult<T>> {
      if (finished) {
        if (!emitted && hasMatch) {
          emitted = true;
          return { value: lastValue, done: false };
        }
        return { value: undefined as any, done: true };
      }

      try {
        let result = await source.next();
        while (!result.done) {
          const value = result.value;
          if (!predicate || (await predicate(value))) {
            lastValue = value;
            hasMatch = true;
          }
          result = await source.next();
        }

        finished = true;

        if (hasMatch) {
          emitted = false; // allow emitting lastValue on next() call
          return next();
        } else {
          throw new Error("No elements in sequence");
        }
      } catch (err) {
        finished = true;
        throw err;
      }
    }

    return { next };
  });
