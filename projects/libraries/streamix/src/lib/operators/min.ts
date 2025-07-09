import { CallbackReturnType, createOperator } from '../abstractions';

export const min = <T = any>(
  comparator?: (a: T, b: T) => CallbackReturnType<number>
) =>
  createOperator<T>('min', (source) => {
    let minValue: T | undefined;
    let hasMin = false;

    // Await entire source and compute min eagerly
    const ready = (async () => {
      while (true) {
        const { value, done: sourceDone } = await source.next();
        if (sourceDone) break;

        if (!hasMin) {
          minValue = value;
          hasMin = true;
        } else if (comparator) {
          if (await comparator(value, minValue!) < 0) {
            minValue = value;
          }
        } else if (value < minValue!) {
          minValue = value;
        }
      }
    })();

    let emitted = false;

    return {
      async next() {
        await ready;

        if (!emitted && hasMin) {
          emitted = true;
          return { value: minValue!, done: false };
        }

        return { value: undefined, done: true };
      },
    };
  });
