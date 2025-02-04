import { createEmission, createStream, Stream } from '../abstractions';

export function timer(delayMs: number = 0, intervalMs: number = 1000): Stream<number> {
  let timerValue = 0;

  // Create a stream using a generator function
  const stream = createStream<number>('timer', async function* () {
    // Initial delay if specified
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Emit the first value immediately
    yield createEmission({ value: timerValue++ });

    // Emit subsequent values at intervals
    while (!stream.completed()) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      yield createEmission({ value: timerValue++ });
    }
  });

  return stream;
}
