import { CallbackReturnType, createOperator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

/**
 * Represents an option for the `fork` operator.
 *
 * Contains a predicate function to test each source value and a handler
 * function that returns a stream to process values matching the predicate.
 */
export interface ForkOption<T = any, R = any> {
  on: (value: T, index: number) => CallbackReturnType<boolean>;
  handler: (value: T) => Stream<R>;
}

/**
 * Routes each value from the source stream through one of multiple handlers
 * based on predicate functions. For each value, the first matching predicate
 * triggers its associated handler stream. Values are emitted sequentially from
 * the active handler before moving to the next source value.
 *
 * Throws an error if no predicate matches the source value.
 */
export const fork = <T = any, R = any>(options: ForkOption<T, R>[]) =>
  createOperator<T, R>('fork', (source) => {
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

            let matched: typeof options[number] | undefined;

            for (const option of options) {
              if (await option.on(outerResult.value, outerIndex++)) {
                matched = option;
                break;
              }
            }

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
