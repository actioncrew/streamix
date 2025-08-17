import { Operator } from "../abstractions";
import { select } from "./select";

/**
 * Creates a stream operator that emits only the single value at the specified zero-based index
 * from the source stream.
 *
 * This operator consumes the source stream until it reaches the `targetIndex`. It then
 * emits the value at that position and immediately completes, effectively ignoring all
 * subsequent values. If the source stream completes before reaching the `targetIndex`,
 * the output stream will also complete without emitting any value.
 *
 * @template T The type of the values in the source stream.
 * @param targetIndex The zero-based index of the element to retrieve. Must be a non-negative number.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 * @throws {Error} Throws an error if `targetIndex` is a negative number.
 */
export const elementAt = <T = any>(targetIndex: number): Operator<T, T> =>
  select<T>(async function* () {
    if (targetIndex < 0) {
      throw new Error(`Invalid index: ${targetIndex}. Index must be non-negative.`);
    }
    yield targetIndex; // Yield only the target index
  }());
