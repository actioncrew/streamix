import { createStream, Stream } from '../abstractions';

/**
 * Creates a timer stream that emits numbers starting from 0.
 * Emits first value after `delayMs` (or immediately if delayMs=0),
 * then emits incrementing values every `intervalMs` milliseconds.
 * If `intervalMs` is not provided, it defaults to `delayMs`.
 */
export function timer(delayMs = 0, intervalMs?: number): Stream<number> {
  const actualInterval = intervalMs ?? delayMs;

  async function* timerGenerator() {
    let count = 0;

    const sleep = (ms: number) =>
      new Promise<void>(resolve => setTimeout(resolve, ms));

    if (delayMs > 0) {
      await sleep(delayMs);
    } else {
      // yield in next microtask to avoid sync emission on subscribe
      await Promise.resolve();
    }

    yield count++;

    while (true) {
      await sleep(actualInterval);
      yield count++;
    }
  }

  return createStream<number>('timer', timerGenerator);
}
