import { createStream, Stream } from '../abstractions';

/**
 * Creates a timer stream that emits numbers starting from 0.
 * Emits first value after `delayMs` (or immediately if delayMs=0),
 * then emits incrementing values every `intervalMs` milliseconds.
 * If `intervalMs` is not provided, it defaults to `delayMs`.
 */
export function timer(delayMs = 0, intervalMs?: number): Stream<number> {
  const actualInterval = intervalMs ?? delayMs;
  const controller = new AbortController();
  const signal = controller.signal;

  async function* timerGenerator() {
    let count = 0;

    function sleep(ms: number): Promise<void> {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        }, ms);

        const onAbort = () => {
          clearTimeout(timeoutId);
          reject(new Error('Timer aborted'));
        };

        signal.addEventListener('abort', onAbort);
      });
    }

    try {
      if (delayMs > 0) {
        await sleep(delayMs);
      } else {
        await Promise.resolve();
      }

      yield count++;

      while (!signal.aborted) {
        await sleep(actualInterval);
        yield count++;
      }
    } finally {
      controller.abort();
    }
  }

  return createStream<number>('timer', timerGenerator);
}
