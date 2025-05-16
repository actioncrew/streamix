import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';

export const skipUntil = <T = any>(notifier: AsyncIterable<any>) =>
  createOperator('skipUntil', (source) => {
    const sourceIterator = source[Symbol.asyncIterator]?.() ?? source;
    const notifierIterator = notifier[Symbol.asyncIterator]?.() ?? notifier;
    let canEmit = false;

    // Start a promise that resolves once notifier emits or completes
    const notifierSignal = (async () => {
      try {
        for await (const _ of notifierIterator) {
          canEmit = true;
          break; // Stop on first emission
        }
      } catch {
        // Ignore errors or handle as needed
      }
      canEmit = true; // Also emit if notifier completes without emission
    })();

    return {
      async next(): Promise<IteratorResult<T>> {
        // Wait until notifier signals to start emitting
        if (!canEmit) {
          await notifierSignal;
        }

        // Now pass values through
        return sourceIterator.next();
      }
    };
  });
