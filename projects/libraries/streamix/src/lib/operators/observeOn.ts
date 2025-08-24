import { createOperator, createStreamResult, DONE, NEXT, Operator } from '../abstractions';
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
  const schedule = (fn: () => void) => {
    if (context === 'microtask') {
      queueMicrotask(fn);
    } else if (context === 'macrotask') {
      setTimeout(fn);
    } else {
      requestIdleCallback(fn);
    }
  };

  return createOperator<T, T>('observeOn', function (this: Operator, source) {
    const output = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const result = createStreamResult(await source.next());
          if (result.done) break;

          schedule(() => output.next(result.value));
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    const iterator = eachValueFrom<T>(output)[Symbol.asyncIterator]();
    let completed = false;

    return {
      async next() {
        while (true) {
          if (completed) {
            return DONE;
          }

          const result = await iterator.next();

          if (result.done) {
            completed = true;
            return DONE;
          }

          return NEXT(result.value);
        }
      }
    };
  });
};
