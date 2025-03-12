import { createStream, Stream } from '../abstractions';

export function timer(delayMs: number = 0, intervalMs?: number): Stream<number> {
  let timerValue = 0;
  const actualIntervalMs = intervalMs ?? delayMs;

  const stream = createStream<number>('timer', async function* (this: Stream) {
    // Initial delay if specified

    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      await Promise.resolve();
    }

    // Emit the first value immediately
    if (!this.completed()) {
      yield timerValue++;
    }

    // Emit subsequent values at intervals
    while (!this.completed()) {
      await new Promise(resolve => setTimeout(resolve, actualIntervalMs));

      if (!this.completed()) {
        yield timerValue++;
      }
    }
  });

  return stream;
}
