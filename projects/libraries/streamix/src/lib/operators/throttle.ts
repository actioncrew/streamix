import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a throttle operator that emits the first value immediately, then ignores subsequent
 * values for the specified duration. If any new values arrive during the cooldown, the
 * last one is emitted after the cooldown expires (trailing emit).
 *
 * This ensures that values are emitted at most once per `duration` milliseconds,
 * but also guarantees the last value during the cooldown is not lost.
 *
 * @template T The type of values emitted by the source and output.
 * @param {number} duration The throttle duration in milliseconds.
 * @returns {Operator<T, T>} An operator function that applies throttling to the source async iterable.
 */
export const throttle = <T = any>(duration: number) =>
  createOperator<T, T>('throttle', (source) => {
    const output = createSubject<T>();

    let lastEmit = 0;
    let pending: T | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Emits the stored pending value, if any, and resets the pending state.
     */
    const flushPending = () => {
      if (pending !== undefined) {
        lastEmit = Date.now();
        output.next(pending);
        pending = undefined;
      }
    };

    (async () => {
      try {
        for (;;) {
          const result = await source.next();
          if (result.done) break;
          if (result.phantom) continue;

          const now = Date.now();

          if (now - lastEmit >= duration) {
            // Enough time has passed — emit immediately (leading)
            lastEmit = now;
            output.next(result.value);
          } else {
            // Within throttle window — store latest pending value
            pending = result.value;

            if (!timer) {
              // Schedule trailing emit after remaining cooldown
              timer = setTimeout(() => {
                flushPending();
                timer = null;
              }, duration - (now - lastEmit));
            }
          }
        }

        // Source completed — emit any pending value trailing
        if (pending !== undefined) flushPending();
      } catch (err) {
        output.error(err);
      } finally {
        if (timer) clearTimeout(timer);
        output.complete();
      }
    })();

    return eachValueFrom(output)[Symbol.asyncIterator]();
  });

