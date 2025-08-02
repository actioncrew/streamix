import { select } from "./select";

export const elementAt = <T = any>(targetIndex: number) =>
  select<T>(async function* () {
    if (targetIndex < 0) {
      throw new Error(`Invalid index: ${targetIndex}. Index must be non-negative.`);
    }
    yield targetIndex; // Yield only the target index
  }());
