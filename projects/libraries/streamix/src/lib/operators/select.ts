import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function select<T = any>(
  predicate: (value: T, index: number) => boolean
): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let index = 0;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (predicate(value, index++)) {
            output.next(value);
          }
        }
        output.complete();
      } catch (err) {
        output.error(err);
      }
    })();

    return output;
  };

  return createMapper('select', operator);
}
