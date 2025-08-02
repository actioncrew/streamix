import { Operator } from "../abstractions";
import { select } from "./select";

/**
 * Emits only the element at the specified zero-based index from the source stream.
 * Throws an error if the index is negative.
 */
export const elementAt = <T = any>(targetIndex: number): Operator<T, T> =>
  select<T>(async function* () {
    if (targetIndex < 0) {
      throw new Error(`Invalid index: ${targetIndex}. Index must be non-negative.`);
    }
    yield targetIndex; // Yield only the target index
  }());
