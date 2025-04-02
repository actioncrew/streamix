import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function elementNth<T = any>(indexPattern: (index: number) => number | undefined): StreamMapper {
  const indexIterator = (function* () {
    let index = 0;
    while (true) {
      const nextIndex = indexPattern(index++);
      if (nextIndex === undefined) break;
      yield nextIndex;
    }
  })();

  return select(indexIterator);
}
