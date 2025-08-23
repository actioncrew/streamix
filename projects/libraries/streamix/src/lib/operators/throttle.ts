import { createOperator, StreamResult } from '../abstractions';
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
  createOperator<T, T>("throttle", (source, context) => {
    const output = createSubject<T>();

    let lastEmit = 0;
    let pending: T | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

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
          const result: StreamResult<T> = await source.next();
          if (result.done) break;

          const now = Date.now();
          if (now - lastEmit >= duration) {
            lastEmit = now;
            output.next(result.value);
          } else {
            await context.phantomHandler(result.value);

            // store as candidate for trailing emit
            pending = result.value;

            if (!timer) {
              timer = setTimeout(() => {
                flushPending();
                timer = null;
              }, duration - (now - lastEmit));
            }
          }
        }

        // source ended → flush last pending
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
