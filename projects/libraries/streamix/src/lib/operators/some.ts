import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function some<T = any>(predicate: (value: T, index: number) => boolean): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<boolean>) => {

    (async () => {
      let index = 0; // Initialize index

      try {
        for await (const value of eachValueFrom(input)) {
          if (predicate(value, index++)) { // Pass value and index to predicate
            output.next(true); // Emit true if any value satisfies the predicate
            output.complete();
            return;
          }
        }
        output.next(false); // Emit false if no values satisfy the predicate
      } catch (err) {
        output.error(err); // Propagate errors
      } finally {
        output.complete(); // Complete the output stream
      }
    })();

    return output;
  };

  return createMapper('some', createSubject<boolean>(), operator);
}
