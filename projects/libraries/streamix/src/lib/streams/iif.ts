import { createStream, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';

export function iif<T = any>(
  condition: () => boolean,
  trueStream: Stream<T>,
  falseStream: Stream<T>
): Stream<T> {
  async function* generator(): AsyncGenerator<T, void, unknown> {
    // Evaluate condition lazily when the stream starts
    const sourceStream = condition() ? trueStream : falseStream;
    const asyncIterable = eachValueFrom<T>(sourceStream);
    const iterator = asyncIterable[Symbol.asyncIterator]();

    try {
      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        yield result.value;
      }
    } finally {
      // Ensure proper cleanup of the iterator
      if (iterator.return) {
        try {
          await iterator.return(undefined);
        } catch {
          // Ignore any errors during cleanup
        }
      }
    }
  }

  return createStream<T>('iif', generator);
}
