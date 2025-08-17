import { Operator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';
import { select } from "./select";

/**
 * Creates a stream operator that emits elements from the source stream at dynamic indices specified
 * by the asynchronous index pattern function.
 *
 * This operator is a powerful tool for selective data retrieval. It uses an `indexPattern`
 * function to determine which elements to pull from the source stream. The function is
 * called repeatedly, with the current iteration count as an argument, and should return the
 * zero-based index of the next element to emit. The process stops when the function returns `undefined`.
 *
 * This is useful for tasks such as:
 * - Sampling a stream at a fixed interval (e.g., every 10th element).
 * - Picking a specific, non-sequential set of elements.
 * - Creating a custom, sparse output stream.
 *
 * @template T The type of the values in the source stream.
 * @param indexPattern The function that specifies the indices to emit. It receives the current
 * iteration count and should return the next index to emit or `undefined` to stop.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const elementNth = <T = any>(
  indexPattern: (iteration: number) => CallbackReturnType<number | undefined>
): Operator<T, T> => {
  const indexIterator: AsyncGenerator<number> = (async function* () {
    let iteration = 0;
    while (true) {
      const nextIndex = await indexPattern(iteration);
      if (nextIndex === undefined) break;
      yield nextIndex;
      iteration++;
    }
  })();

  return select<T>(indexIterator);
};
