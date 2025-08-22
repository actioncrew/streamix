import { createOperator } from "../abstractions";
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that buffers a fixed number of values and emits them as arrays.
 *
 * This operator collects values from the source stream until the buffer reaches the
 * specified `bufferSize`. Once the buffer is full, it is emitted as an array, and a new
 * buffer is started. If the source stream completes before the buffer is full, the
 * operator will emit any remaining values and then complete.
 *
 * @template T The type of the values in the stream.
 * @param bufferSize The maximum number of values to collect in each buffer. Defaults to `Infinity`.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const bufferCount = <T = any>(bufferSize: number = Infinity) =>
  createOperator<T, T[]>("bufferCount", (source) => {
    let completed = false;

    return {
      async next(): Promise<StreamResult<T[]>> {
        while (true) {
          if (completed) {
            return { done: true, value: undefined };
          }

          const buffer: T[] = [];

          while (buffer.length < bufferSize) {
            const result = await source.next();

            if (result.done) {
              completed = true;
              // Emit any remaining buffered items before completing
              return buffer.length > 0
                ? { done: false, value: buffer }
                : { done: true, value: undefined };
            }

            if (result.phantom) continue;

            buffer.push(result.value);
          }

          // Buffer full, emit it
          return { done: false, value: buffer };
        }
      }
    };
  });
