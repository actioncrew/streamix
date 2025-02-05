import { createEmission, createStream, Stream } from '../abstractions';

export function timer(delayMs: number = 0, intervalMs?: number): Stream<number> {
  let timerValue = 0;
  const actualIntervalMs = intervalMs ?? delayMs;

  const stream = createStream<number>('timer', async function* () {
    // Initial delay if specified
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Emit the first value immediately
    if (!stream.completed()) {
      yield createEmission({ value: timerValue++ });
    }

    // Emit subsequent values at intervals
    while (!stream.completed()) {
      await new Promise(resolve => setTimeout(resolve, actualIntervalMs));

      if (!stream.completed()) {
        yield createEmission({ value: timerValue++ });
      }
    }
  });

  return stream;
}
