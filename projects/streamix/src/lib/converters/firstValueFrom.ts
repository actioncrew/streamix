import { Stream } from "../abstractions";

export async function firstValueFrom<T>(stream: Stream<T>): Promise<T> {
  try {
    // Use the async iterator to get the first value
    for await (const emission of stream) {
      return emission.value!; // Return the first emitted value
    }
  } catch (err) {
    throw err; // Propagate any errors from the stream
  }

  // If stream completes without emitting a value, throw an error
  throw new Error("Stream completed without emitting a value");
}
