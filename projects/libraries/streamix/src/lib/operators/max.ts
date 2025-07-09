import { createOperator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';

export const max = <T = any>(
  comparator?: (a: T, b: T) => CallbackReturnType<number>
) =>
  createOperator<T>('max', (source) => {
    let maxValue: T | undefined;
    let hasMax = false;

    // Process the source eagerly
    const ready = (async () => {
      while (true) {
        const { value, done: sourceDone } = await source.next();
        if (sourceDone) break;

        if (!hasMax) {
          maxValue = value;
          hasMax = true;
        } else if (comparator) {
          if (await comparator(value, maxValue!) > 0) {
            maxValue = value;
          }
        } else if (value > maxValue!) {
          maxValue = value;
        }
      }
    })();

    let emitted = false;

    return {
      async next() {
        await ready;

        if (!emitted && hasMax) {
          emitted = true;
          return { value: maxValue!, done: false };
        }

        return { value: undefined, done: true };
      },
    };
  });
