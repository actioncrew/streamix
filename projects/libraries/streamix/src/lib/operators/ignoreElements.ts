import { createOperator } from "../abstractions";

/**
 * Creates a stream operator that ignores all values emitted by the source stream.
 *
 * This operator consumes the source stream but does not emit any values. It only
 * forwards the completion or error signal from the source stream. This is useful
 * when you only care about the "end" of an operation, not the intermediate results.
 * For example, waiting for a stream of side effects to complete before continuing.
 *
 * @template T The type of the values in the source stream (which are ignored).
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const ignoreElements = <T>() =>
  createOperator<T, never>("ignoreElements", (source) => ({
    async next(): Promise<IteratorResult<never>> {
      while (true) {
        const result = await source.next();
        if (result.done) {
          return { done: true, value: undefined as never };
        }
      }
    }
  }));
