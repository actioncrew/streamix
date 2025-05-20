import { createOperator } from "../abstractions";

export const finalize = (callback: () => void | Promise<void>) =>
  createOperator("finalize", (source) => {
    let finalized = false;

    return {
      async next(): Promise<IteratorResult<any>> {
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
