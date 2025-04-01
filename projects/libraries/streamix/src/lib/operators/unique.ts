import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function unique<T = any, K = any>(keySelector?: (value: T) => K): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    const seenKeys = new Set<K | T>();

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          const currentKey = keySelector ? keySelector(value) : value;

          if (!seenKeys.has(currentKey)) {
            output.next(value);
            seenKeys.add(currentKey);
          }
        }
        output.complete();
      } catch (err) {
        output.error(err);
      }
    })();

    return output;
  };

  return createMapper('unique', operator);
}
          
