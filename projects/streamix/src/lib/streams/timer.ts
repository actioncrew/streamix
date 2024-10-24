import { createStream } from '../abstractions/stream';
import { Stream } from '../abstractions/stream';

export function timer(delayMs: number = 0, intervalMs?: number): Stream<number> {
  let timerValue = 0;
  let timeoutId: any | undefined;
  let intervalId: any | undefined;

  const run = async (stream: Stream<number>): Promise<void> => {
    try {
      if (await initialDelay(stream)) {
        return; // Stream was completed during the delay
      }

      await emitValue(stream);

      if (intervalMs !== undefined && intervalMs > 0) {
        await startInterval(stream);
      } else {
        stream.isAutoComplete = true; // Mark the stream for auto completion
      }
    } catch (error) {
      await stream.onError.process({ error });
    } finally {
      finalize();
    }
  };

  const initialDelay = async (stream: Stream<number>): Promise<boolean> => {
    if (delayMs === 0) {
      return stream.shouldComplete();
    }

    return new Promise<boolean>((resolve) => {
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        resolve(stream.shouldComplete());
      }, delayMs);
    });
  };

  const emitValue = async (stream: Stream<number>): Promise<void> => {
    if (stream.shouldComplete()) {
      return;
    }
    await stream.onEmission.process({ emission: { value: timerValue }, source: stream });
    timerValue++;
  };

  const startInterval = (stream: Stream<number>): Promise<void> => {
    return new Promise<void>((resolve) => {
      intervalId = setInterval(async () => {
        try {
          if (stream.shouldComplete()) {
            finalize();
            resolve();
            return;
          }
          await emitValue(stream);
        } catch (error) {
          await stream.onError.process({ error });
          finalize();
          resolve();
        }
      }, intervalMs);
    });
  };

  const finalize = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  // Create and return the stream using createStream
  return createStream<number>(run);
}
