import { CallbackReturnType, createOperator } from "../abstractions";

export const some = <T = any>(
  predicate: (value: T, index: number) => CallbackReturnType<boolean>
) =>
  createOperator<T, boolean>('some', (source) => {
    let evaluated = false;
    let result: boolean = false;
    let index = 0;

    return {
      async next(): Promise<IteratorResult<boolean>> {
        if (evaluated) {
          return { value: undefined, done: true };
        }

        try {
          while (true) {
            const itemResult = await source.next();
            if (itemResult.done) {
              break; // Source completed
            }
            if (await predicate(itemResult.value, index++)) {
              result = true;
              break; // Predicate matched, no need to continue
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
