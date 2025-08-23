import { COMPLETE, createOperator } from "../abstractions";
import { NEXT } from './../abstractions/operator';
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that emits a final, specified value after the source stream has completed.
 *
 * The operator first consumes all values from the upstream source. Once the source stream signals
 * its completion (`done`), this operator then emits the `finalValue` and immediately completes.
 *
 * @template T The type of the values in the stream.
 * @param finalValue The value to be emitted as the last item in the stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const endWith = <T = any>(finalValue: T) =>
  createOperator<T, T>("endWith", (source, context) => {
    let sourceDone = false;
    let finalEmitted = false;
    let completed = false;

    return {
      async next(): Promise<StreamResult<T>> {
        while (true) {
          if (completed) {
            return COMPLETE;
          }

          if (!sourceDone) {
            const result = await source.next();
            if (!result.done && result.phantom) { context.phantomHandler(result.value); continue; }

            if (!result.done) {
              return result;
            }

            sourceDone = true;
          }


          if (!finalEmitted) {
            finalEmitted = true;
            return NEXT(finalValue);
          }

          completed = true;
          return COMPLETE;
        }
      }
    };
  });
