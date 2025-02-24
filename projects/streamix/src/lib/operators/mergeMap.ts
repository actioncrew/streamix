import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams/subject';

export function mergeMap<T, R>(project: (value: T, index: number) => Stream<R>): StreamOperator {
  return createStreamOperator('mergeMap', (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();
    let activeInnerStreams = 0; // Track active inner streams
    let hasError = false; // Flag to track if an error has occurred
    let index = 0;

    // Async function to handle inner streams
    const processInnerStream = async (innerStream: Stream<R>) => {
      try {
        for await (const innerEmission of innerStream) {
          if (hasError) return; // Stop processing if an error has occurred
          output.next(innerEmission.value!);
        }
      } catch (err) {
        if (!hasError) {
          hasError = true; // Set the error flag
          output.error(err); // Propagate the error from the inner stream
        }
      } finally {
        // Decrease the count of active inner streams
        activeInnerStreams -= 1;
        // If all inner streams are processed and the outer stream is complete, complete the output stream
        if (activeInnerStreams === 0 && input.completed()) {
          output.complete();
        }
      }
    };

    // Process the outer stream emissions
    (async () => {
      try {
        for await (const emission of input) {
          if (hasError) return; // Stop processing if an error has occurred

          const innerStream = project(emission.value!, index++); // Project input to inner stream
          activeInnerStreams += 1;
          processInnerStream(innerStream); // Process the inner stream concurrently
        }
      } catch (err) {
        if (!hasError) {
          hasError = true; // Set the error flag
          output.error(err); // Propagate the error from the outer stream
        }
      } finally {
        // If outer stream completes and there are no active inner streams, complete the output stream
        if (activeInnerStreams === 0 && !hasError) {
          output.complete();
        }
      }
    })();

    return output;
  });
}
