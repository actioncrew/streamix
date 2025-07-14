import { createOperator, Operator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Schedules the emission of values from the source on a specified execution context.
 *
 * @param queue A string indicating the desired execution context.
 * Currently supports 'microtask' for microtask queue scheduling,
 * and 'macrotask' queue scheduling (setTimeout(..., 0)).
 * @returns An operator function that transforms a source stream.
 */
export const observeOn = <T = any>(context: "microtask" | "macrotask"): Operator => {
  return createOperator<T>('observeOn', (source) => {
    const output = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;

          if (context === 'microtask') {
            queueMicrotask(() => output.next(value));
          } else {
            setTimeout(() => output.next(value));
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
};
