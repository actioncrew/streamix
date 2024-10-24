import { createStream, Stream } from '../abstractions';

export function timer(delayMs: number = 0, intervalMs?: number): Stream<number> {
  let timerValue = 0;
  let timeoutId: any;
  let intervalId: any;
  const actualIntervalMs = intervalMs ?? delayMs;

  const stream = createStream<number>(async function(): Promise<void> {
    try {
      if (delayMs === 0) {
        if (stream.shouldComplete()) return;
      } else {
        await new Promise<void>((resolve) => {
          timeoutId = setTimeout(() => {
            timeoutId = undefined;
            resolve();
          }, delayMs);
        });

        if (stream.shouldComplete()) return;
      }

      // Initial emission
      await stream.onEmission.process({
        emission: { value: timerValue },
        source: stream
      });
      timerValue++;

      if (actualIntervalMs > 0) {
        await new Promise<void>((resolve) => {
          intervalId = setInterval(async () => {
            try {
              if (stream.shouldComplete()) {
                clearInterval(intervalId);
                intervalId = undefined;
                resolve();
                return;
              }

              await stream.onEmission.process({
                emission: { value: timerValue },
                source: stream
              });
              timerValue++;
            } catch (error) {
              clearInterval(intervalId);
              intervalId = undefined;
              await stream.onError.process({ error });
              resolve();
            }
          }, actualIntervalMs);
        });
      } else {
        stream.isAutoComplete = true;
      }
    } catch (error) {
      await stream.onError.process({ error });
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

  return stream;
}
