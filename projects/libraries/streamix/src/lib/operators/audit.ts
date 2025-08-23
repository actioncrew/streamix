import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that emits the latest value from the source stream
 * at most once per specified duration.
 *
 * @template T The type of the values in the stream.
 * @param duration The time in milliseconds to wait before emitting the latest value.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const audit = <T = any>(duration: number) => {
  return createOperator<T, T>('audit', (source, context) => {
    const output = createSubject<T>();

    let lastValue: T | undefined = undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined = undefined;

    const startTimer = () => {
      timerId = setTimeout(() => {
        if (lastValue !== undefined) {
          output.next(lastValue);
          lastValue = undefined;
        }
        timerId = undefined; // Timer has finished
      }, duration);
    };

    // Start processing the source
    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) {
            // Corrected completion logic
            if (lastValue !== undefined) {
              output.next(lastValue);
            }
            break;
          }

          // If a timer is active, the previous lastValue becomes phantom
          if (timerId !== undefined && lastValue !== undefined) {
            await await context.phantomHandler(lastValue);
          }

          lastValue = result.value;

          // Start a new timer only if one isn't already active
          if (timerId === undefined) {
            startTimer();
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        // Clear any pending timers on completion
        if (timerId !== undefined) {
          clearTimeout(timerId);
          timerId = undefined;
        }
        output.complete();
      }
    })();

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
};
