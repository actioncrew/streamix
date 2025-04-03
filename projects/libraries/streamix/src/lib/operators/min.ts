import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function min<T = any>(comparator?: (a: T, b: T) => number): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();

    (async () => {
      let minValue: T | undefined;
      try {
        for await (const value of eachValueFrom(input)) {
          if (minValue === undefined || (comparator ? comparator(value, minValue) < 0 : value < minValue!)) {
            minValue = value;
          }
        }
        if (minValue !== undefined) {
          output.next(minValue);
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    return output;
  };

  return createMapper('min', operator);
}
