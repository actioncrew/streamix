import { CallbackReturnType, createOperator } from "../abstractions";

/**
 * Emits `true` if all elements satisfy the predicate,
 * otherwise emits `false` upon the first failure.
 *
 * Completes after emitting the single boolean result.
 */
export const every = <T = any>(
  predicate: (value: T, index: number) => CallbackReturnType<boolean>
) =>
  createOperator<T, boolean>("every", (source) => {
    let index = 0;
    let emitted = false;

    return {
      async next(): Promise<IteratorResult<boolean>> {
        if (emitted) return { done: true, value: undefined };

        while (true) {
          const { value, done } = await source.next();

          if (done) {
            emitted = true;
            return { done: false, value: true };
          }

          if (!await predicate(value, index++)) {
            emitted = true;
            return { done: false, value: false };
          }
        }
      },
    };
  });
