import { CallbackReturnType, createOperator } from '../abstractions';

export const distinctUntilChanged = <T = any>(
  comparator?: (prev: T, curr: T) => CallbackReturnType<boolean>
) =>
  createOperator<T>('distinctUntilChanged', (source) => {
    let lastValue: T | undefined;
    let hasLast = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          const { value, done } = await source.next();
          if (done) return { value: undefined, done: true };

          if (!hasLast || !(comparator ? await comparator(lastValue!, value) : lastValue === value)) {
            lastValue = value;
            hasLast = true;
            return { value, done: false };
          }
        }
      },
    };
  });
