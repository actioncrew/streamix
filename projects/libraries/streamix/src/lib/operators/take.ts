import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function take<T>(count: number): StreamMapper {
  return createMapper("take", createSubject<T>(), (input: Stream<T>, output: Subject<T>) => {
    let emittedCount = 0;
    let isCompleted = false;

    // Async function to iterate through the input stream and take `count` values
    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (emittedCount < count) {
            emittedCount++;
            output.next(value);
            if (emittedCount === count) {
              isCompleted = true;
              output.complete();
              break; // Stop processing once we've emitted the required number of values
            }
          }
        }
      } catch (err) {
        output.error(err); // Propagate errors from the input stream
      } finally {
        // Ensure completion if it wasn't done earlier
        if (!isCompleted) {
          output.complete();
        }
      }
    })();
  });
}
