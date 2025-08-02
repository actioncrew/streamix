import { createOperator } from "../abstractions";

/**
 * Operator that ignores all elements emitted by the source stream,
 * completing only when the source completes.
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
