import { createStream, Emission, Stream } from "../abstractions";

/**
 * Retry a stream with a maximum retry count and delay, buffering values and checking for errors first.
 *
 * @param factory - A function to create the source stream.
 * @param maxRetries - The maximum number of retry attempts.
 * @param delay - The delay between retry attempts in milliseconds.
 * @returns A stream that emits the same values as the source stream, with retries on error.
 */
export function retry<T = any>(
  factory: () => Stream<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Stream<T> {
  return createStream<T>("retry", async function* (this: Stream<T>) {
    let retryCount = 0;
    let errorEmitted = false; // Flag to track if error is emitted

    // Buffer to store emitted values temporarily
    let buffer: Emission<T>[] = [];

    while (retryCount <= maxRetries && !errorEmitted) {
      try {
        buffer.length = 0;
        // Create a fresh stream each time we retry
        const sourceStream = factory();

        // Collect all values from the stream into the buffer
        for await (const emission of sourceStream) {
          buffer.push(emission); // Buffer the value
        }

        // If no error was thrown, emit the buffered values
        for (const emission of buffer) {
          yield emission;
        }

        // If successful, break out of the retry loop
        break;
      } catch (error) {
        retryCount++;

        if (retryCount > maxRetries) {
          errorEmitted = true; // Mark that error is emitted
          throw error; // Emit the error after max retries
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  });
}
