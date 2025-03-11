import { Stream } from "../abstractions";

export async function* eachValueFrom<T>(stream: Stream<T>): AsyncGenerator<T> {
  try {
    for await (const emission of stream) {
      yield emission.value!; // Yield the value from each emission
    }
  } catch (err) {
    throw err; // Propagate any errors from the stream
  }
}
