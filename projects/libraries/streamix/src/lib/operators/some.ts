import { createOperator } from "../abstractions";

export const some = <T = any>(
  predicate: (value: T, index: number) => boolean
) =>
  createOperator('some', (source) => {
    const iterator = source[Symbol.asyncIterator]?.() ?? source;
    let evaluated = false;
    let result: boolean = false;
    let index = 0;

    return {
      async next(): Promise<IteratorResult<boolean>> {
        if (evaluated) {
          return { value: undefined, done: true };
        }

        try {
          for await (const item of iterator) {
            if (predicate(item, index++)) {
              result = true;
              break;
            }
          }
        } catch (err) {
          throw err;
        } finally {
          evaluated = true;
        }

        return { value: result, done: false };
      }
    };
  });
