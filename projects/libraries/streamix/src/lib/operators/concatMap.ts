import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function concatMap<T, R>(project: (value: T, index: number) => Stream<R>): StreamMapper {
  let index = 0;
  const operator = (input: Stream<T>, output: Subject<R>) => {
    let inputCompleted = false;
    let activeInnerStreams = 0; // Track active inner streams

    // Async generator to process inner streams sequentially
    const processInnerStream = async (innerStream: Stream<R>) => {
      try {
        for await (const value of eachValueFrom(innerStream)) {
          output.next(value); // Forward value from inner stream
        }
      } catch (err) {
        // Handle error in inner stream without affecting other emissions
        output.error(err); // Propagate error from the inner stream
      } finally {
        activeInnerStreams -= 1;
        if (activeInnerStreams === 0&& inputCompleted) {
          output.complete(); // Complete the output stream when all inner streams are processed
        }
      }
    };

    // Iterate over the input stream using async iterator
    (async () => {
      try {
        let hasValue = false;
        for await (const value of eachValueFrom(input)) {
          hasValue = true;
          const innerStream = project(value, index++); // Project input to inner stream
          activeInnerStreams += 1;
          processInnerStream(innerStream); // Process the inner stream sequentially
        }

        // If no values were emitted in the outer stream, complete immediately
        if (!hasValue && !inputCompleted) {
          output.complete();
        }
      } catch (err) {
        output.error(err);
      } finally {
        inputCompleted = true;
        // If all inner streams are done, complete the output stream
        if (activeInnerStreams === 0) {
          output.complete();
        }
      }
    })();

    return output;
  };

  return createMapper('concatMap', createSubject<R>(), operator);
}
