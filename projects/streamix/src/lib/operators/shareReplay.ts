import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject, createReplaySubject } from "../streams";

export function shareReplay<T>(bufferSize: number = Number.POSITIVE_INFINITY): StreamOperator {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createReplaySubject<T>(bufferSize);

    // Async generator to handle the input stream with shareReplay logic
    (async () => {
      try {
        for await (const emission of input) {
          output.next(emission.value!); // Replay the value from the input stream
        }
      } catch (err) {
        output.error(err); // Propagate any error
      } finally {
        output.complete(); // Complete the replay subject
      }
    })();

    return output;
  };

  return createStreamOperator('shareReplay', operator);
}
