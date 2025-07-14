import { Stream, createStream } from '../abstractions';

/**
 * Creates a timer stream that emits numbers starting from 0.
 * Emits first value after `delayMs` (or immediately if delayMs=0),
 * then emits incrementing values every `intervalMs` milliseconds.
 * If `intervalMs` is not provided, it defaults to `delayMs`.
 */
export function timer(delayMs = 0, intervalMs?: number): Stream<number> {
  const actualInterval = intervalMs ?? delayMs;

  return createStream<number>('timer', async function* () {
    let count = 0;

    // Initial delay if specified
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      // Yield immediately without delay
      await Promise.resolve();
    }

    yield count++;

    // Emit subsequent values on interval
    while (true) {
      await new Promise(resolve => setTimeout(resolve, actualInterval));
      yield count++;
    }
  });
}
