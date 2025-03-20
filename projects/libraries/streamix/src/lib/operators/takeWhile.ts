import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function takeWhile<T>(predicate: (value: T) => boolean): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();

    (async () => {
      let isCompleted = false;

      try {
        for await (const value of eachValueFrom(input)) {
          // If predicate returns false, complete the stream
          if (!predicate(value)) {
            output.complete();
            isCompleted = true;
            break;
          }
          output.next(value);
        }
      } catch (err) {
        output.error(err);
      } finally {
        if (!isCompleted) {
          output.complete();
        }
      }
    })();

    return output;
  };

  return createMapper('takeWhile', operator);
}
