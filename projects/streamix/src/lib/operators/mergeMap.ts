import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams/subject";

export function mergeMap<T, R>(project: (value: T) => Stream<R>): StreamOperator {
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();
    let isOuterComplete = false;
    let activeInnerStreams = 0; // Track active inner streams

    // Async generator to process inner streams concurrently
    const processInnerStream = async (innerStream: Stream<R>) => {
      try {
        for await (const emission of innerStream) {
          output.next(emission.value!); // Forward value from inner stream
        }
      } catch (err) {
        output.error(err);
      } finally {
        activeInnerStreams -= 1;
        if (isOuterComplete && activeInnerStreams === 0) {
          output.complete(); // Complete the output stream when all inner streams are processed
        }
      }
    };

    // Iterate over the input stream using async iterator
    (async () => {
      try {
        for await (const emission of input) {
          const innerStream = project(emission.value!); // Project input to inner stream
          activeInnerStreams += 1;
          processInnerStream(innerStream); // Process the inner stream concurrently
        }
      } catch (err) {
        output.error(err);
      } finally {
        // If outer stream is complete and there are no active inner streams, complete output stream
        if (isOuterComplete && activeInnerStreams === 0) {
          output.complete();
        }
      }
    })();

    // Handling the outer stream's completion
    input.subscribe({
      next: () => {}, // This is handled by the async iterator already
      error: (err) => output.error(err),
      complete: () => {
        isOuterComplete = true;
        if (activeInnerStreams === 0) {
          output.complete(); // Complete the output stream if all inner streams are done
        }
      },
    });

    return output;
  };

  return createStreamOperator('mergeMap', operator);
}
