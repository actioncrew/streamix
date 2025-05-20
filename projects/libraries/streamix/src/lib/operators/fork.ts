import { createOperator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

export interface ForkOption<T, R> {
  on: (value: T, index: number) => boolean;
  handler: (value: T) => Stream<R>;
}

export const fork = <T, R>(options: ForkOption<T, R>[]) =>
  createOperator('fork', (source) => {
    let outerIndex = 0;
    let innerIterator: AsyncIterator<R> | null = null;

    return {
      async next(): Promise<IteratorResult<R>> {
        while (true) {
          // If no active inner iterator, get next outer value
          if (!innerIterator) {
            const outerResult = await source.next();
            if (outerResult.done) {
              return { done: true, value: undefined };
            }

            const matched = options.find(({ on }) => on(outerResult.value, outerIndex++));
            if (!matched) {
              throw new Error(`No handler found for value: ${outerResult.value}`);
            }

            innerIterator = eachValueFrom(matched.handler(outerResult.value));
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
