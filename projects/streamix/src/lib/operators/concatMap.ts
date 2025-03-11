import { createStreamOperator, Stream, Transformer } from "../abstractions";
import { createSubject } from "../streams/subject";

export function concatMap<T, R>(project: (value: T, index: number) => Stream<R>): Transformer {
  let index = 0;
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();
    let isOuterComplete = false;
    let activeInnerStreams = 0; // Track active inner streams

    // Async generator to process inner streams sequentially
    const processInnerStream = async (innerStream: Stream<R>) => {
      try {
        for await (const emission of innerStream) {
          output.next(emission.value!); // Forward value from inner stream
        }
      } catch (err) {
        // Handle error in inner stream without affecting other emissions
        output.error(err); // Propagate error from the inner stream
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
        let hasValue = false;
        for await (const emission of input) {
          hasValue = true;
          const innerStream = project(emission.value!, index++); // Project input to inner stream
          activeInnerStreams += 1;
          processInnerStream(innerStream); // Process the inner stream sequentially
        }

        // If no values were emitted in the outer stream, complete immediately
        if (!hasValue && !isOuterComplete) {
          output.complete();
        }
      } catch (err) {
        output.error(err);
      } finally {
        isOuterComplete = true;
        // If all inner streams are done, complete the output stream
        if (activeInnerStreams === 0) {
          output.complete();
        }
      }
    })();

    return output;
  };

  return createStreamOperator('concatMap', operator);
}
