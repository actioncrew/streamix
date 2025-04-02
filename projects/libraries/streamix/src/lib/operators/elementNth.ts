import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function elementNth<T = any>(indexPattern: (index: number) => boolean): StreamMapper {
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

