import { createOperator } from "../abstractions";

export const sample = <T = any>(period: number) =>
  createOperator('sample', (source) => {
    let lastValue: T | undefined;
    let done = false;

    // Source iterator
    const sourceIterator = source[Symbol.asyncIterator]?.() ?? source;

    // Timer promise resolver
    let timerResolve: (() => void) | null = null;
    const timerPromise = () =>
      new Promise<void>((resolve) => (timerResolve = resolve));

    // Start periodic timer that resolves every 'period' ms
    const startTimer = () => {
      setInterval(() => {
        if (timerResolve) {
          timerResolve();
          timerResolve = null;
        }
      }, period);
    };

    // Start timer immediately
    startTimer();

    return {
      async next(): Promise<IteratorResult<T>> {
        while (!done) {
          // Pull from source until exhausted or next timer tick
          const result = await sourceIterator.next();
          if (result.done) {
            done = true;
            // Emit last value if exists, then complete on next call
            if (lastValue !== undefined) {
              const value = lastValue;
              lastValue = undefined;
              return { value, done: false };
            }
            return { value: undefined, done: true };
          }
          lastValue = result.value;

          // Wait for next sampling tick before emitting
          await timerPromise();
          return { value: lastValue, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  });
