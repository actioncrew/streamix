import { COMPLETE, createOperator, NEXT } from "../abstractions";
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
  createOperator<T, T[]>("toArray", (source, context) => {
    const collected: T[] = [];
    let completed = false;
    let emitted = false;
    const phantomQueue: T[] = [];

    return {
      async next(): Promise<StreamResult<T[]>> {
        while (true) {
          // If everything is done and no more phantoms -> complete
          if (completed && emitted && phantomQueue.length === 0) {
            return COMPLETE;
          }

          // First drain phantom queue
          if (phantomQueue.length > 0) {
            const phantomValue = phantomQueue.shift()!;
            await context.phantomHandler(phantomValue);
            continue;
          }

          // Otherwise consume from source
          const result = await source.next();

          if (result.done) {
            completed = true;
            if (!emitted) {
              emitted = true;
              // emit final array (may be empty)
              return NEXT(collected);
            }
            // after array emission we loop back to phantomQueue
            continue;
          }

          // collect real value
          collected.push(result.value);
          phantomQueue.push(result.value);
        }
      },
    };
  });
