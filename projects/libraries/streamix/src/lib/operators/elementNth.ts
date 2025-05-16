import { select } from "./select";

export const elementNth = <T = any>(indexPattern: (iteration: number) => number | undefined) => {
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
