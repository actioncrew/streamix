import { CallbackReturnType, createOperator, DONE, Operator } from "../abstractions";

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
export const finalize = <T = any>(callback: () => CallbackReturnType) => {
  // Shared state across all subscriptions - moved outside createOperator
  let finalized = false;
  let completed = false;
  let finalizationPromise: Promise<void> | null = null;

  const doFinalize = async () => {
    if (!finalized) {
      finalized = true;
      completed = true;
      
      // Create finalization promise if it doesn't exist
      if (!finalizationPromise) {
        finalizationPromise = (async () => {
          try {
            await callback?.();
          } catch (error) {
            // Log error but don't throw to prevent unhandled promise rejection
            console.error('Finalization callback error:', error);
          }
        })();
      }
      
      await finalizationPromise;
    } else if (finalizationPromise) {
      // Wait for existing finalization to complete
      await finalizationPromise;
    }
  };

  return createOperator<T, T>("finalize", function (this: Operator, source) {
    return {
      next: async () => {
        while (true) {
          if (completed) {
            return DONE;
          }

          try {
            const result = await source.next();

            if (result.done) {
              await doFinalize();
              return DONE;
            }

            return result;
          } catch (err) {
            await doFinalize();
            throw err;
          }
        }
      }
    };
  });
};