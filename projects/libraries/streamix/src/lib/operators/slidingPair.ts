import { COMPLETE, createOperator, NEXT } from "../abstractions";
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that emits pairs of values from the source stream,
 * where each pair consists of the previous and the current value.
 *
 * This operator is a powerful tool for comparing consecutive values in a stream.
 * It maintains an internal state to remember the last value it received. For
 * each new value, it creates a tuple of `[previousValue, currentValue]` and
 * emits it to the output stream.
 *
 * The very first value emitted will have `undefined` as its "previous" value.
 *
 * @template T The type of the values in the source stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method,
 * emitting tuples of `[T | undefined, T]`.
 */
export const slidingPair = <T = any>() =>
  createOperator<T, [T | undefined, T]>('slidingPair', (source, context) => {
    let prev: T | undefined = undefined;
    let first = true;
    let completed = false;

    return {
      async next(): Promise<StreamResult<[T | undefined, T]>> {
        while (true) {
          if (completed) {
            return COMPLETE;
          }

          const result = await source.next();

          if (result.done) {
            completed = true;
            return COMPLETE;
          }

          if (result.phantom) { context.phantomHandler(result.value); continue; }

          const value: [T | undefined, T] = [first ? undefined : prev, result.value];
          prev = result.value;
          first = false;
          return NEXT(value);
        }
      }
    };
  });
