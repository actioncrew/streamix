import { createOperator } from "../abstractions";

export interface ForkOption<T, R> {
  on: (value: T, index: number) => boolean;
  handler: (value: T) => AsyncIterable<R>;
}

export const fork = <T, R>(options: ForkOption<T, R>[]) =>
  createOperator('fork', (source) => {
    let outerIndex = 0;
    let outerDone = false;
    let innerIterator: AsyncIterator<R> | null = null;

    return {
      async next(): Promise<IteratorResult<R>> {
        while (true) {
          // If no active inner iterator, get next outer value
          if (!innerIterator) {
            const outerResult = await source.next();
            if (outerResult.done) {
              outerDone = true;
              return { done: true, value: undefined };
            }

            const matched = options.find(({ on }) => on(outerResult.value, outerIndex++));
            if (!matched) {
              throw new Error(`No handler matched value: ${outerResult.value}`);
            }

            innerIterator = matched.handler(outerResult.value)[Symbol.asyncIterator]();
          }

          // Pull next inner value
          const innerResult = await innerIterator.next();
          if (innerResult.done) {
            innerIterator = null;
            continue; // Try next outer value
          }

          return { done: false, value: innerResult.value };
        }
      }
    };
  });
