import { createStreamOperator, Stream, Transformer } from "../abstractions";
import { createSubject } from "../streams/subject";

export function take<T>(count: number): Transformer {
  return createStreamOperator("take", (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let emittedCount = 0;
    let isCompleted = false;

    // Async function to iterate through the input stream and take `count` values
    (async () => {
      try {
        for await (const value of input) {
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

    return output;
  });
}
