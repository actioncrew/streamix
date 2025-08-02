import { CallbackReturnType, createOperator } from "../abstractions";

/**
 * Calls a callback when the source stream completes or errors.
 * Ensures the callback runs only once, after termination.
 */
export const finalize = <T = any>(callback: () => CallbackReturnType) =>
  createOperator<T, T>("finalize", (source) => {
    let finalized = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        try {
          const result = await source.next();

          if (result.done && !finalized) {
            finalized = true;
            await callback?.();
          }

          return result;
        } catch (err) {
          if (!finalized) {
            finalized = true;
            await callback?.();
          }
          throw err;
        }
      }
    };
  });
