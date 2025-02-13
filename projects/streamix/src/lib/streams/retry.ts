import { createStream, Stream } from "../abstractions";

export function retry<T = any>(source: Stream<T>, maxRetries = 3, delayMs = 1000): Stream<T> {
  return createStream("retryStream", async function* () {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        for await (const emission of source) {
          yield emission;
        }
        return; // Stop retrying when source completes successfully
      } catch (error) {
        if (attempt === maxRetries) {
          throw error; // Give up after max retries
        }

        attempt++;

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  });
}
