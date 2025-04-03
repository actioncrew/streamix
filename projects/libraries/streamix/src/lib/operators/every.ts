
import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function every<T = any>(predicate: (value: T, index: number) => boolean): StreamMapper {
  const operator = (input: Stream<T>): Stream<boolean> => {
    const output = createSubject<boolean>();

    (async () => {
      let index = 0; // Initialize index

      try {
        for await (const value of eachValueFrom(input)) {
          if (!predicate(value, index++)) { // Pass value and index to predicate
            output.next(false); // Emit false if any value fails the predicate
            output.complete();
            return;
          }
        }
        output.next(true); // Emit true if all values pass the predicate
      } catch (err) {
        output.error(err); // Propagate errors
      } finally {
        output.complete(); // Complete the output stream
      }
    })();

    return output;
  };

  return createMapper('every', operator);
}
