
import { Stream, createStream } from '../abstractions';
import { eachValueFrom } from '../converters';

export function defer<T = any>(factory: () => Stream<T>): Stream<T> {
  return createStream(
    "defer",
    async function* () {
      // Lazily create the inner stream when the generator is first consumed
      const innerStream = factory();

      try {
        // Convert the inner stream to async iterable and yield all values
        for await (const value of eachValueFrom(innerStream)) {
          yield value;
        }
      } catch (error) {
        // Re-throw any errors from the inner stream
        throw error;
      }
      // Cleanup is automatic when the async generator completes
    }
  );
}
