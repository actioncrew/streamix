import { createOperator } from "../abstractions";
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that collects all emitted values from the source stream
 * into an array and emits that array as a single value once the source completes.
 *
 * This operator is an aggregation tool. It consumes all values from the source,
 * buffers them in memory, and only produces a single output when the source stream
 * has completed. Because it holds all values in memory, it should be used with
 * caution on very large or infinite streams.
 *
 * @template T The type of the values in the source stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 * The output stream will emit a single array of type `T[]`.
 */
export const toArray = <T = any>() =>
  createOperator<T, T[]>("toArray", (source) => {
    const collected: T[] = [];
    let emitted = false;

    return {
      async next(): Promise<StreamResult<T[]>> {
        while (true) {
          if (emitted) return { done: true, value: undefined };
          const result = await source.next();

          if (result.done) {
            emitted = true;
            return { done: false, value: collected };
          }

          if (result.phantom) continue;

          collected.push(result.value);
        }
      }
    };
  });
