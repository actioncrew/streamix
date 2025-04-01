import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function select<T = any>(indexIterator: Iterator<number>): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let currentIndex = 0;
    let nextIndex = indexIterator.next().value;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (nextIndex === undefined) {
            output.complete();
            break;
          }

          if (currentIndex === nextIndex) {
            output.next(value);
            nextIndex = indexIterator.next().value;
          }

          currentIndex++;
        }
      } catch (err) {
        output.error(err);
      } finally {
        if (!output.completed()) {
          output.complete();
        }
      }
    })();

    return output;
  };

  return createMapper('select', operator);
}
