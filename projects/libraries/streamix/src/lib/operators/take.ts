import { createOperator } from "../abstractions";

/**
 * Emits only the first `count` values from the source stream,
 * then completes the output stream.
 */
export const take = <T = any>(count: number) =>
  createOperator<T, T>("take", (source) => {
    let emitted = 0;
    let done = false;

    return {
      async next() {
        if (done) return { done: true, value: undefined };

        if (emitted >= count) {
          done = true;
          return { done: true, value: undefined };
        }

        const result = await source.next();

        if (result.done) {
          done = true;
          return { done: true, value: undefined };
        }

        emitted++;
        return { done: false, value: result.value };
      }
    };
  });
