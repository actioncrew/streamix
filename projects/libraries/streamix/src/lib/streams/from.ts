import { createStream, Stream } from "../abstractions";

export function from<T = any>(source: AsyncIterable<T> | Iterable<T>): Stream<T> {
  return createStream<T>("from", async function* () {
    // Wrap the iterable with the stream generator
    for await (const value of source) {
      yield value;
    }
  });
}
