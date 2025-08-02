import { createOperator } from "../abstractions";

/**
 * Emits pairs of values from the source where each pair consists of the previous
 * and the current value. The first pair will have `undefined` as the previous value.
 */
export const slidingPair = <T = any>() =>
  createOperator<T, [T | undefined, T]>('slidingPair', (source) => {
    let prev: T | undefined = undefined;
    let first = true;

    return {
      async next(): Promise<IteratorResult<[T | undefined, T]>> {
        const { value, done } = await source.next();

        if (done) {
          return { value: undefined as any, done: true };
        }

        const result: [T | undefined, T] = [first ? undefined : prev, value];
        prev = value;
        first = false;
        return { value: result, done: false };
      }
    };
  });
