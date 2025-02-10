import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams";

export function concatMap<T, R>(project: (value: T) => Stream<R>): StreamOperator {
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();

    // Async function to process the input stream and inner streams sequentially
    (async () => {
      try {
        for await (const emission of input) {
          const innerStream = project(emission.value!); // Project input to inner stream

          try {
            // Process the inner stream sequentially
            for await (const innerEmission of innerStream) {
              output.next(innerEmission.value!); // Forward value from the inner stream
            }
          } catch (innerErr) {
            output.error(innerErr); // Propagate errors from the inner stream
            return; // Stop processing if an inner stream errors
          }
        }

        // If the outer stream completes without errors, complete the output stream
        output.complete();
      } catch (outerErr) {
        output.error(outerErr); // Propagate errors from the outer stream
      }
    })();

    return output;
  };

  return createStreamOperator('concatMap', operator);
}
