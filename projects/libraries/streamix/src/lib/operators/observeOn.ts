import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Schedules the emission of values from the source on a specified execution context.
 *
 * @param context A string indicating the desired execution context.
 * Currently supports 'microtask' for microtask queue scheduling,
 * and any other string for macrotask queue scheduling (setTimeout(..., 0)).
 * @returns An operator function that transforms a source stream.
 */
export function observeOn<T = any>(queue: "microtask" | "macrotask") {
  return createOperator('observeOn', (source) => {
    const output = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;

          // Schedule the emission based on the provided context
          if (queue === 'microtask') {
            await new Promise<void>((resolve) => {
              queueMicrotask(() => {
                output.next(result.value);
                resolve();
              });
            });
          } else if (queue === 'macrotask') {
            // Default to macrotask (setTimeout) for other contexts
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                output.next(result.value);
                resolve();
              });
            });
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    return eachValueFrom(output);
  });
}
