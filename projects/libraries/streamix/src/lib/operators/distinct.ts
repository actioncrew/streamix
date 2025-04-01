import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function distinct<T = any, K = any>(keySelector?: (value: T) => K): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let previousKey: K | T | undefined;
    let firstValue = true;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          const currentKey = keySelector ? keySelector(value) : value;

          if (firstValue || currentKey !== previousKey) {
            output.next(value);
            previousKey = currentKey;
            firstValue = false;
          }
        }
        output.complete();
      } catch (err) {
        output.error(err);
      }
    })();

    return output;
  };

  return createMapper('distinct', operator);
}
