import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createReplaySubject, Subject } from "../streams";

export function shareReplay<T>(bufferSize: number = Infinity): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    // Async generator to handle the input stream with shareReplay logic
    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          output.next(value); // Replay the value from the input stream
        }
      } catch (err) {
        output.error(err); // Propagate any error
      } finally {
        output.complete(); // Complete the replay subject
      }
    })();
  };

  return createMapper('shareReplay', createReplaySubject<T>(bufferSize), operator);
}
