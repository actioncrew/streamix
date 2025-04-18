import { createMapper, Stream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

export function mergeMap<T, R>(project: (value: T, index: number) => Stream<R>): StreamMapper {
  let index = 0;
  return createMapper('mergeMap', createSubject<R>(), (input: Stream<T>, output: Subject<R>) => {
    let activeInnerStreams = 0; // Track active inner streams
    let inputCompleted = false;
    let hasError = false; // Flag to track if an error has occurred

    // Async function to handle inner streams
    const processInnerStream = async (innerStream: Stream<R>) => {
      try {
        for await (const value of eachValueFrom(innerStream)) {
          if (hasError) return; // Stop processing if an error has occurred
          output.next(value);
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
        if (activeInnerStreams === 0 && inputCompleted) {
          output.complete();
        }
      }
    };

    // Process the outer stream emissions
    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (hasError) return; // Stop processing if an error has occurred

          const innerStream = project(value, index++); // Project input to inner stream
          activeInnerStreams += 1;
          processInnerStream(innerStream); // Process the inner stream concurrently
        }
      } catch (err) {
        if (!hasError) {
          hasError = true; // Set the error flag
          output.error(err); // Propagate the error from the outer stream
        }
      } finally {
        inputCompleted = true;
        if (activeInnerStreams === 0) {
          output.complete();
        }
      }
    })();
  });
}
