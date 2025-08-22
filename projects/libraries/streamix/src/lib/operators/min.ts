import { CallbackReturnType, createOperator } from '../abstractions';
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that emits the minimum value from the source stream.
 *
 * This is a terminal operator that must consume the entire source stream before
 * it can emit a single value. It iterates through all values, keeping track of
 * the smallest one seen so far.
 *
 * @template T The type of the values in the source stream.
 * @param comparator An optional function to compare two values. It should return a negative
 * number if `a` is less than `b`, a positive number if `a` is greater than `b`, and zero
 * if they are equal. Defaults to using the `<` operator for comparison.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const min = <T = any>(
  comparator?: (a: T, b: T) => CallbackReturnType<number>
) =>
  createOperator<T, T>('min', (source) => {
    let minValue: T | undefined;
    let hasMin = false;
    const phantomQueue: T[] = [];

    // Eagerly process the source
    const ready = (async () => {
      while (true) {
        const result = await source.next();
        if (result.done) break;

        const value = result.value;

        if (!hasMin) {
          minValue = value;
          hasMin = true;
        } else if (comparator) {
          if (await comparator(value, minValue!) < 0) {
            phantomQueue.push(minValue!); // previous min becomes phantom
            minValue = value;
          } else {
            phantomQueue.push(value); // non-min is phantom
          }
        } else if (value < minValue!) {
          phantomQueue.push(minValue!); // previous min becomes phantom
          minValue = value;
        } else {
          phantomQueue.push(value); // non-min is phantom
        }
      }
    })();

    let emittedMin = false;

    return {
      async next(): Promise<StreamResult<T>> {
        await ready;

        // Emit queued phantoms first
        if (phantomQueue.length > 0) {
          const value = phantomQueue.shift()!;
          return { value, done: false, phantom: true };
        }

        // Emit the real min once
        if (!emittedMin && hasMin) {
          emittedMin = true;
          return { value: minValue!, done: false };
        }

        // Completed
        return { value: undefined, done: true };
      },
    };
  });
