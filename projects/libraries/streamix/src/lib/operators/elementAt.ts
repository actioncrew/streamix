import { StreamMapper } from "../abstractions";
import { select } from "../operators";

export function elementAt<T = any>(targetIndex: number): StreamMapper {
  return select<T>(function* () {
    if (targetIndex < 0) {
      throw new Error(`Invalid index: ${targetIndex}. Index must be non-negative.`);
    }
    yield targetIndex; // Yield only the target index
  }());
}
