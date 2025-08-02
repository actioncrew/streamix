import { createOperator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

export const delayUntil = <T = any>(notifier: Stream<any>) =>
  createOperator<T, T>("delayUntil", (source) => {
    let canEmit = false;
    let notifierDone = false;
    let notifierStarted = false;
    const buffer: T[] = [];

    const waitForNotifier = async () => {
      if (notifierStarted) return;
      notifierStarted = true;
      try {
        for await (const _ of eachValueFrom(notifier)) {
          void _;
          canEmit = true;
          break;
        }
      } catch (_) {
        // ignore errors, just unblock
      } finally {
        notifierDone = true;
      }
    };

    waitForNotifier();

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          if (canEmit) {
            if (buffer.length) {
              return { value: buffer.shift()!, done: false };
            }
            return source.next();
          }

          const result = await source.next();
          if (result.done) return result;
          buffer.push(result.value);

          if (notifierDone) {
            // fallback in case notifier ends without emitting
            canEmit = true;
          }
        }
      },
    };
  });
