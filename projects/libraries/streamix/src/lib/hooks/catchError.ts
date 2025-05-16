import { createOperator } from "../abstractions";

export const catchError = <T>(
  fallback: (err: any) => AsyncIterable<T>
) =>
  createOperator("catchError", (source) => {
    let activeIterator: AsyncIterator<T> | null = source;
    let handled = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (!activeIterator) return { done: true, value: undefined };

        try {
          const result = await activeIterator.next();
          if (result.done) {
            activeIterator = null;
          }
          return result;
        } catch (err) {
          if (handled) throw err; // Don't handle again
          handled = true;
          activeIterator = fallback(err)[Symbol.asyncIterator]();
          return this.next(); // retry with fallback
        }
      }
    };
  });
