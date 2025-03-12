import { createStreamOperator, Stream, Transformer } from "../abstractions";
import { createSubject } from "../streams/subject";

export const withLatestFrom = (...streams: Stream<any>[]): Transformer => {
  const operator = (inputStream: Stream<any>): Stream<any> => {
    const output = createSubject<any>();
    const latestValues: any[] = new Array(streams.length).fill(undefined);
    const hasValue: boolean[] = new Array(streams.length).fill(false);
    let allStreamsHaveEmitted = false;

    // Async generator to handle each stream
    const processStreams = async () => {
      const iterators = streams.map((stream) => stream[Symbol.asyncIterator]());

      try {
        // Wait for all streams to emit at least one value
        while (!allStreamsHaveEmitted) {
          const nextValues = await Promise.all(iterators.map((iterator) => iterator.next()));

          // Collect the values
          nextValues.forEach((result, index) => {
            if (!result.done) {
              latestValues[index] = result.value;
              hasValue[index] = true;
            }
          });

          // Check if all streams have emitted at least once
          allStreamsHaveEmitted = hasValue.every((v) => v);
        }

        // Process the input stream while collecting the latest values
        for await (const value of inputStream) {
          if (allStreamsHaveEmitted) {
            output.next([value, ...latestValues]); // Emit the main value along with the latest values
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    };

    // Run the stream processing
    processStreams();

    // Return the output stream
    return output;
  };

  return createStreamOperator('withLatestFrom', operator);
};
