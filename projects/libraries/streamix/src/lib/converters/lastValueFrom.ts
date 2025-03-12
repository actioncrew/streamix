import { Stream } from "../abstractions";

export async function lastValueFrom<T>(stream: Stream<T>): Promise<T> {
  let lastValue: T | undefined;
  let hasValue = false;

  try {
    // Use async iterator to iterate over the stream
    for await (const value of stream) {
      lastValue = value;
      hasValue = true;
    }

    if (hasValue) {
      return lastValue as T; // Return the last emitted value
    } else {
      throw new Error("Stream completed without emitting a value");
    }
  } catch (err) {
    throw err; // Propagate any errors from the stream
  }
}
