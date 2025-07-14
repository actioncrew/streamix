import { createStream, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";

export function iif<T = any>(
  condition: () => boolean,
  trueStream: Stream<T>,
  falseStream: Stream<T>
): Stream<T> {
  return createStream(
    'iif',
    async function* () {
      // Evaluate the condition lazily when the stream is subscribed to
      const sourceStream = condition() ? trueStream : falseStream;

      // Convert the chosen stream to an AsyncIterable and yield all its values
      const asyncIterable = eachValueFrom(sourceStream);

      for await (const value of asyncIterable) {
        yield value;
      }
    }
  );
}
