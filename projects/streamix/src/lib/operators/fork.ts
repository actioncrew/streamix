import { createStreamOperator, Stream, Transformer } from "../abstractions";
import { createSubject } from "../streams";

export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T, index: number) => boolean; handler: (value: T) => Stream<R> }>
): Transformer => {
  let index = 0;
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();
    let activeInnerStreams = 0; // Track active inner streams

    // Helper function to handle inner streams concurrently
    const processInnerStream = async (innerStream: Stream<R>) => {
      try {
        for await (const innerEmission of innerStream) {
          output.next(innerEmission.value!); // Forward value from the inner stream
        }
      } catch (innerErr) {
        output.error(innerErr); // Propagate errors from the inner stream
      } finally {
        activeInnerStreams -= 1; // Decrease active inner stream count
        // If all inner streams are done, complete the output stream
        if (activeInnerStreams === 0 && input.completed()) {
          output.complete();
        }
      }
    };

    // Async function to process the input stream and inner streams concurrently
    (async () => {
      try {
        // Use a for-await loop to process the outer stream
        for await (const emission of input) {
          const matchedOption = options.find(({ on }) => on(emission.value!, index++));

          if (matchedOption) {
            const innerStream = matchedOption.handler(emission.value!); // Create inner stream
            activeInnerStreams += 1; // Increment active inner stream count

            // Process the inner stream concurrently without awaiting each one
            processInnerStream(innerStream);
          } else {
            // Log a warning if no handler is found (optional)
            throw Error(`No handler found for value: ${emission.value!}`);
          }
        }
      } catch (outerErr) {
        output.error(outerErr); // Propagate errors from the outer stream
      }
    })();

    // Return the output stream
    return output;
  };

  return createStreamOperator('fork', operator);
};
