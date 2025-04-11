import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function skipWhile<T = any>(predicate: (value: T) => boolean): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    (async () => {
      let skipping = true; // Initially skipping values

      try {
        for await (const value of eachValueFrom(input)) {
          if (skipping && !predicate(value)) {
            skipping = false; // Stop skipping once predicate returns false
          }

          if (!skipping) {
            output.next(value); // Emit values once skipping ends
          }
        }
      } catch (err) {
        output.error(err); // Propagate errors
      } finally {
        output.complete(); // Complete the output stream
      }
    })();

    return output;
  };

  return createMapper('skipWhile', createSubject<T>(), operator);
}
