import { createMapper, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function partition<T = any>(
  predicate: (value: T, index: number) => boolean
) {
  const operator = (input: Stream<T>): [Stream<T>, Stream<T>] => {
    // Create two output streams
    const trueStream = createSubject<T>();
    const falseStream = createSubject<T>();
    let index = 0;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (predicate(value, index++)) {
            trueStream.next(value);
          } else {
            falseStream.next(value);
          }
        }
        trueStream.complete();
        falseStream.complete();
      } catch (err) {
        trueStream.error(err);
        falseStream.error(err);
      }
    })();

    return [trueStream, falseStream];
  };

  return createMapper('partition', operator);
}
