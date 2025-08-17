import { createOperator } from "../abstractions";

/**
 * Creates a stream operator that emits a default value if the source stream is empty.
 *
 * This operator monitors the source stream for any emitted values. If the source
 * stream completes without emitting any values, this operator will emit a single
 * `defaultValue` and then complete. If the source stream does emit at least one value,
 * this operator will pass all values through and will not emit the `defaultValue`.
 *
 * @template T The type of the values in the stream.
 * @param defaultValue The value to emit if the source stream is empty.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const defaultIfEmpty = <T = any>(defaultValue: T) =>
  createOperator<T, T>("defaultIfEmpty", (source) => {
    let emitted = false;
    let done = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (done) return { done: true, value: undefined };

        const result = await source.next();

        if (!result.done) {
          emitted = true;
          return result;
        }

        if (!emitted) {
          emitted = true;
          done = true;
          return { done: false, value: defaultValue };
        }

        done = true;
        return { done: true, value: undefined };
      }
    };
  });
