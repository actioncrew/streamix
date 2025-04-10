import { Stream, StreamMapper, createMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export const first = <T = any>(predicate?: (value: T) => boolean): StreamMapper => {
  return createMapper("first", (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let found = false;

    // Async function to iterate through the input stream and take the first value matching the predicate (or the first value)
    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (!found && (!predicate || predicate(value))) {
            found = true;
            output.next(value); // Emit the first matching value
            break;              // Stop processing once we've emitted the first value
          }
        }

        // If no value was found, raise an error
        if (!found) {
          throw new Error("No elements in sequence");
        }
      } catch (err) {
        output.error(err); // Propagate any errors that occur
      } finally {
        output.complete();
      }
    })();

    return output; // Return the output stream
  });
};
