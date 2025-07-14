import { createStream, Stream } from "../abstractions";

export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  return createStream(
    'fromPromise',
    async function* () {
      try {
        yield await promise;
      } catch (error) {
        throw error;
      }
    }
  );
}
