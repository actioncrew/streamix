import { createOperator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that emits the maximum value from the source stream.
 *
 * This is a terminal operator that must consume the entire source stream before
 * it can emit a single value. It iterates through all values, keeping track of
 * the largest one seen so far.
 *
 * @template T The type of the values in the source stream.
 * @param comparator An optional function to compare two values. It should return a positive
 * number if `a` is greater than `b`, a negative number if `a` is less than `b`, and zero
 * if they are equal. Defaults to using the `>` operator for comparison.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const max = <T = any>(
  comparator?: (a: T, b: T) => CallbackReturnType<number>
) =>
  createOperator<T, T>("max", (source) => {
    let maxValue: T | undefined;
    let hasMax = false;
    const phantomQueue: T[] = []; // store intermediate phantoms

    // Process source eagerly
    const ready = (async () => {
      while (true) {
        const result = await source.next();
        if (result.done) break;

        const value = result.value;

        if (!hasMax) {
          maxValue = value;
          hasMax = true;
        } else if (comparator) {
          if (await comparator(value, maxValue!) > 0) {
            phantomQueue.push(maxValue!); // previous max becomes phantom
            maxValue = value;
          } else {
            phantomQueue.push(value); // non-max is phantom
          }
        } else if (value > maxValue!) {
          phantomQueue.push(maxValue!); // previous max becomes phantom
          maxValue = value;
        } else {
          phantomQueue.push(value); // non-max is phantom
        }
      }
    })();

    let emittedMax = false;

    return {
      async next(): Promise<StreamResult<T>> {
        await ready;

        // Emit queued phantoms first
        if (phantomQueue.length > 0) {
          const value = phantomQueue.shift()!;
          return { value, done: false, phantom: true };
        }

        // Emit real max once
        if (!emittedMax && hasMax) {
          emittedMax = true;
          return { value: maxValue!, done: false };
        }

        // Completed
        return { value: undefined, done: true };
      },
    };
  });
