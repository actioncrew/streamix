import { CallbackReturnType, Operator } from "../abstractions";
import { select } from "./select";

export const elementNth = <T = any>(indexPattern: (iteration: number) => CallbackReturnType<number | undefined>) => {
  const indexIterator = (async function* () {
    let iteration = 0;
    while (true) {
      const nextIndex = await indexPattern(iteration);
      if (nextIndex === undefined) break;
      yield nextIndex;
      iteration++;
    }
  })();

  return select<T>(indexIterator) as Operator;
}
