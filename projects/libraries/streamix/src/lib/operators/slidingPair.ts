import { createOperator } from "../abstractions";

export const slidingPair = <T = any>() =>
  createOperator('slidingPair', (source) => {
    const sourceIterator = source[Symbol.asyncIterator]?.() ?? source;
    let prev: T | undefined = undefined;
    let first = true;

    return {
      async next(): Promise<IteratorResult<[T | undefined, T]>> {
        const { value, done } = await sourceIterator.next();

        if (done) {
          return { value: undefined, done: true };
        }

        const result: [T | undefined, T] = [first ? undefined : prev, value];
        prev = value;
        first = false;
        return { value: result, done: false };
      }
    };
  });
