import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that emits the latest value from the source stream
 * at most once per specified duration.
 *
 * This operator is a form of trailing-edge throttle. It ignores values that arrive
 * while a timer is active. When a new value arrives and the timer is not active,
 * it starts a new timer. Upon the timer's expiration, it emits the most recent
 * buffered value and resets its state, ready for the next duration window.
 *
 * This is useful for limiting the rate of event handling, for example, to process
 * a user's resizing of a window only after they have stopped.
 *
 * @template T The type of the values in the stream.
 * @param duration The time in milliseconds to wait before emitting the latest value.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const audit = <T = any>(duration: number) => {
  return createOperator<T, T>('audit', (source) => {
    const output = createSubject<T>();

    let lastValue: T | undefined = undefined;
    let timerActive = false;

    const startTimer = () => {
      timerActive = true;
      setTimeout(() => {
        if (lastValue !== undefined) {
          output.next(lastValue);
          lastValue = undefined;
        }
        timerActive = false;
      }, duration);
    };

    // Start processing the source
    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;
          if (result.phantom) continue;

          if (timerActive && lastValue !== undefined) {
            output.phantom(lastValue);
          }

          lastValue = result.value;

          if (!timerActive) {
            startTimer();
          }
        }

        // If a value is still buffered after stream ends, emit it
        if (!timerActive && lastValue !== undefined) {
          output.next(lastValue);
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
};
