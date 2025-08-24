import { createOperator, Operator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

/**
 * Creates a throttle operator that emits the first value immediately, then ignores subsequent
 * values for the specified duration. If new values arrive during the cooldown, the
 * last one is emitted after the cooldown expires (trailing emit).
 *
 * This version tracks pending results and phantoms in PipeContext.
 *
 * @template T The type of values emitted by the source and output.
 * @param duration The throttle duration in milliseconds.
 * @returns An Operator instance that applies throttling to the source stream.
 */
export const throttle = <T = any>(duration: number) =>
  createOperator<T, T>('throttle', function (this: Operator, source) {
    const output: Subject<T> = createSubject<T>();
    let lastEmit = 0;
    let pendingResult: IteratorResult<T> | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flushPending = () => {
      if (pendingResult !== undefined) {
        output.next(pendingResult.value!);
        pendingResult = undefined;
      }
      timer = null;
      lastEmit = Date.now();
    };

    (async () => {
      try {
        while (true) {
          const result: IteratorResult<T> = await source.next();
          if (result.done) break;

          const now = Date.now();
          if (now - lastEmit >= duration) {
            // Emit immediately
            output.next(result.value);
            lastEmit = now;
          } else {

            pendingResult = result;

            // Schedule trailing emit
            if (!timer) {
              const delay = duration - (now - lastEmit);
              timer = setTimeout(flushPending, delay);
            }
          }
        }

        // Source completed → flush trailing pending
        if (pendingResult !== undefined) flushPending();
      } catch (err) {
        output.error(err);
      } finally {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        output.complete();
      }
    })();

    return eachValueFrom(output)[Symbol.asyncIterator]();
  });
