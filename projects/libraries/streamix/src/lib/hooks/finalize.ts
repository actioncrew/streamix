import { CallbackReturnType, COMPLETE, createOperator } from "../abstractions";
import { StreamResult } from './../abstractions/stream';

/**
 * Creates a stream operator that invokes a finalizer callback upon stream termination.
 *
 * This operator is useful for performing cleanup tasks, such as closing resources
 * or logging, after a stream has completed or encountered an error. The provided
 * `callback` is guaranteed to be called exactly once, regardless of whether the
 * stream terminates gracefully or with an error.
 *
 * @template T The type of the values emitted by the stream.
 * @param callback The function to be called when the stream completes or errors.
 * It can be synchronous or return a Promise.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const finalize = <T = any>(callback: () => CallbackReturnType) =>
  createOperator<T, T>("finalize", (source, context) => {
    let finalized = false;
    let completed = false;

    return {
      async next(): Promise<StreamResult<T>> {
        while (true) {
          if (completed) {
            return COMPLETE;
          }

          try {
            const result = await source.next();

            if (result.done && !finalized) {
              finalized = true;
              completed = true;
              await callback?.();
              return COMPLETE;
            }

            if (result.done) {
              completed = true;
              return COMPLETE;
            }

            if (result.phantom) { context.phantomHandler(result.value); continue; }

            return result;
          } catch (err) {
            if (!finalized) {
              finalized = true;
              completed = true;
              await callback?.();
            }
            throw err;
          }
        }
      }
    };
  });
