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
            output.complete(); // Complete when indexIterator is exhausted
            break;
          }

          if (currentIndex === nextIndex) {
            output.next(value); // Emit the value at the selected index
            nextIndex = indexIterator.next().value; // Move to the next index
          }

          currentIndex++;
        }
      } catch (err) {
        output.error(err); // Forward any errors
      } finally {
        if (!output.completed()) {
          output.complete(); // Ensure completion if the stream wasn't already completed
        }
      }
    })();

    return output;
  };

  return createMapper('select', operator);
}
