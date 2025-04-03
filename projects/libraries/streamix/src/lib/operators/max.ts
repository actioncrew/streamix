import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function max<T = any>(comparator?: (a: T, b: T) => number): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();

    (async () => {
      let maxValue: T | undefined;
      try {
        for await (const value of eachValueFrom(input)) {
          if (maxValue === undefined || (comparator ? comparator(value, maxValue) > 0 : value > maxValue!)) {
            maxValue = value;
          }
        }
        if (maxValue !== undefined) {
          output.next(maxValue);
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    return output;
  };

  return createMapper('max', operator);
}
