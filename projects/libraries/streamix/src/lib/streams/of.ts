import { createStream, Stream } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  return createStream<T>('of', async function* () {
    yield value;
  });
}
