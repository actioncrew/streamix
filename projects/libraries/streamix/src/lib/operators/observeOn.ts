import { createOperator } from '../abstractions';

/**
 * Schedules the emission of values from the source on a specified execution context.
 *
 * @param queue A string indicating the desired execution context.
 * Currently supports 'microtask' for microtask queue scheduling,
 * and 'macrotask' queue scheduling (setTimeout(..., 0)).
 * @returns An operator function that transforms a source stream.
 */
export function observeOn(queue: "microtask" | "macrotask") {
  return createOperator("observeOn", (source) => {
    const schedule =
      queue === "microtask"
        ? () => new Promise<void>((resolve) => queueMicrotask(resolve))
        : () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    return {
      async next() {
        try {
          const result = await source.next();
          if (result.done) {
            return result;
          }

          await schedule();

          return { value: result.value, done: false };
        } catch (err) {
          throw err;
        }
      }
    };
  });
}
