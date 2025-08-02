import { CallbackReturnType } from './../abstractions/receiver';
import { select } from "./select";

/**
 * Emits elements from the source stream at dynamic indices specified
 * by the asynchronous index pattern function.
 *
 * The `indexPattern` function receives the current iteration count
 * and returns the next index to emit or `undefined` to stop.
 */
export const elementNth = <T = any>(
  indexPattern: (iteration: number) => CallbackReturnType<number | undefined>
) => {
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
