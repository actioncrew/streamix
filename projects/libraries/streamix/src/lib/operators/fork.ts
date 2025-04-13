import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T, index: number) => boolean; handler: (value: T) => Stream<R> }>
): StreamMapper => {
  let index = 0;
  const operator = (input: Stream<T>, output: Subject<R>) => {
    let inputCompleted = false;
    let activeInnerStreams = 0; // Track active inner streams

    // Helper function to handle inner streams concurrently
    const processInnerStream = async (innerStream: Stream<R>) => {
      try {
        for await (const value of eachValueFrom(innerStream)) {
          output.next(value); // Forward value from the inner stream
        }
      } catch (innerErr) {
        output.error(innerErr); // Propagate errors from the inner stream
      } finally {
        activeInnerStreams -= 1; // Decrease active inner stream count
        // If all inner streams are done, complete the output stream
        if (activeInnerStreams === 0 && inputCompleted) {
          output.complete();
        }
      }
    };

    // Async function to process the input stream and inner streams concurrently
    (async () => {
      try {
        // Use a for-await loop to process the outer stream
        for await (const value of eachValueFrom(input)) {
          const matchedOption = options.find(({ on }) => on(value, index++));

          if (matchedOption) {
            const innerStream = matchedOption.handler(value); // Create inner stream
            activeInnerStreams += 1; // Increment active inner stream count

            // Process the inner stream concurrently without awaiting each one
            processInnerStream(innerStream);
          } else {
            // Log a warning if no handler is found (optional)
            throw Error(`No handler found for value: ${value}`);
          }
        }
      } catch (outerErr) {
        output.error(outerErr); // Propagate errors from the outer stream
      } finally {
        inputCompleted = true;
        if (activeInnerStreams === 0) {
          output.complete();
        }
      }
    })();
  };

  return createMapper('fork', createSubject<R>(), operator);
};
