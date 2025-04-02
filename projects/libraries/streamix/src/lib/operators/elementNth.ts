import { StreamMapper } from "../abstractions";
import { select } from "../operators";

export function elementNth<T = any>(indexPattern: (iteration: number) => number | undefined): StreamMapper {
  const indexIterator = (function* () {
    let iteration = 0;
    while (true) {
      const nextIndex = indexPattern(iteration);
      if (nextIndex === undefined) break;
      yield nextIndex;
      iteration++;
    }
  })();

  return select<T>(indexIterator);
}
