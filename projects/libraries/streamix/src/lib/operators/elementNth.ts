import { StreamMapper } from "../abstractions";
import { select } from "../operators";

export function elementNth(indexPattern: (index: number) => boolean): StreamMapper {
  const indexIterator = (function* () {
    let index = 0;
    while (true) {
      if (indexPattern(index)) {
        yield index;
      }
      index++;
    }
  })();

  return select(indexIterator);
}

