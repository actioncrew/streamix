import { createEmission, createStream, internals, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export function timer(delayMs: number = 0, intervalMs?: number): Stream<number> {
  let timerValue = 0;
  let timeoutId: any;
  let intervalId: any;
  const actualIntervalMs = intervalMs ?? delayMs;

  const stream = createStream<number>(async function(this: Stream<number>): Promise<void> {
    try {
      if (delayMs === 0) {
        if (this[internals].shouldComplete()) return;
      } else {
        await new Promise<void>((resolve) => {
          timeoutId = setTimeout(() => {
            timeoutId = undefined;
            resolve();
          }, delayMs);
        });

        if (this[internals].shouldComplete()) return;
      }

      // Initial emission
      eventBus.enqueue({ target: this, payload: { emission: createEmission({ value: timerValue }), source: this }, type: 'emission' });
      timerValue++;

      if (actualIntervalMs > 0) {
        await new Promise<void>((resolve) => {
          intervalId = setInterval(async () => {
            try {
              if (this[internals].shouldComplete()) {
                clearInterval(intervalId);
                intervalId = undefined;
                resolve();
                return;
              }

              eventBus.enqueue({ target: this, payload: { emission: createEmission({ value: timerValue }), source: this }, type: 'emission' });

              timerValue++;
            } catch (error) {
              clearInterval(intervalId);
              intervalId = undefined;
              eventBus.enqueue({ target: this, payload: { error }, type: 'error' });
              resolve();
            }
          }, actualIntervalMs);
        });
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { error }, type: 'error' });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    }
  });

  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function(): Promise<void> {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
    return originalComplete();
  };

  stream.name = "timer";
  return stream;
}
