import { createOperator } from '../abstractions';

export const debounce = <T = any>(duration: number) =>
  createOperator('debounce', (sourceIter) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let latestValue: T | null = null;
    let done = false;

    const waitForDebounce = () =>
      new Promise<{ value: T | null; done: boolean }>((resolve) => {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          const valueToEmit = latestValue;
          latestValue = null;
          resolve({ value: valueToEmit, done: false });
        }, duration);
      });

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next(): Promise<IteratorResult<T>> {
        if (done) {
          return { done: true, value: undefined as any };
        }

        while (true) {
          if (timeoutId) {
            const debounced = await waitForDebounce();
            if (debounced.value !== null) {
              return { done: false, value: debounced.value };
            }
            if (done) {
              return { done: true, value: undefined as any };
            }
          }

          const { value, done: sourceDone } = await sourceIter.next();
          if (sourceDone) {
            done = true;
            if (timeoutId) {
              const debounced = await waitForDebounce();
              if (debounced.value !== null) {
                return { done: false, value: debounced.value };
              }
            }
            return { done: true, value: undefined as any };
          }

          latestValue = value;

          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          timeoutId = setTimeout(() => {
            timeoutId = null;
          }, duration);
        }
      },
    };
  });
