import { CallbackReturnType, createOperator } from '../abstractions';

/**
 * Skips values from the source while the predicate returns true.
 * Emits values once the predicate returns false for the first time.
 */
export const skipWhile = <T = any>(predicate: (value: T) => CallbackReturnType<boolean>) =>
  createOperator<T, T>('skipWhile', (source) => {
    let skipping = true;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { value, done } = await source.next();

          if (done) {
            return { value: undefined, done: true };
          }

          if (skipping) {
            if (!await predicate(value)) {
              skipping = false;
              return { value, done: false };
            }
            // If still skipping, continue looping
          } else {
            return { value, done: false };
          }
        }
      }
    };
  });
