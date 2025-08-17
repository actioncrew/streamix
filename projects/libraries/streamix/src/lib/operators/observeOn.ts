import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that schedules the emission of each value from the source
 * stream on a specified JavaScript task queue.
 *
 * This operator is a scheduler. It decouples the timing of value production from
 * its consumption, allowing you to control when values are emitted to downstream
 * operators. This is essential for preventing long-running synchronous operations
 * from blocking the main thread and for prioritizing different types of work.
 *
 * The operator supports three contexts:
 * - `"microtask"`: Emits the value at the end of the current task using `queueMicrotask`.
 * - `"macrotask"`: Emits the value in the next event loop cycle using `setTimeout(0)`.
 * - `"idle"`: Emits the value when the browser is idle using `requestIdleCallback`.
 *
 * @template T The type of the values in the source and output streams.
 * @param context The JavaScript task queue context to schedule emissions on.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const observeOn = <T = any>(context: "microtask" | "macrotask" | "idle") => {
  return createOperator<T, T>('observeOn', (source) => {
    const output = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) {
            // Schedule completion signal and break
            if (context === 'microtask') {
              queueMicrotask(() => output.complete());
            } else if (context === 'macrotask') {
              setTimeout(() => output.complete());
            } else {
              requestIdleCallback(() => output.complete());
            }
            break;
          }

          if (context === 'microtask') {
            queueMicrotask(() => output.next(value));
          } else if (context === 'macrotask') {
            setTimeout(() => output.next(value));
          } else {
            requestIdleCallback(() => output.next(value));
          }
        }
      } catch (err) {
        // Schedule error signal
        if (context === 'microtask') {
          queueMicrotask(() => output.error(err));
        } else if (context === 'macrotask') {
          setTimeout(() => output.error(err));
        } else {
          requestIdleCallback(() => output.error(err));
        }
      }
    })();

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
};
