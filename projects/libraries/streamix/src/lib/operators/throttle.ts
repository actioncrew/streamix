import { createOperator, createStreamResult, Operator } from '../abstractions';
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
  createOperator<T, T>('throttle', function (this: Operator, source, context) {
    const output: Subject<T> = createSubject<T>();
    let lastEmit = 0;
    let pendingValue: T | undefined;
    let pendingResult: any = undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flushPending = (sc: any) => {
      if (pendingValue !== undefined && pendingResult !== undefined) {
        output.next(pendingValue);
        sc?.resolvePending(this, pendingResult);
        pendingValue = undefined;
        pendingResult = undefined;
      }
      timer = null;
      lastEmit = Date.now();
    };

    (async () => {
      try {
        while (true) {
          const sc = context?.currentStreamContext();
          const result = await source.next();

          if (result.done) break;

          const now = Date.now();
          if (now - lastEmit >= duration) {
            // Emit immediately
            output.next(result.value);
            lastEmit = now;
          } else {
            // Previous value is superseded → mark as phantom if any
            if (pendingResult !== undefined && sc) {
              sc.markPhantom(this, pendingResult);
            }

            // Create proper pending result for current value
            const newPendingResult = createStreamResult({
              value: result.value,
              done: false
            });

            // Add current value as pending
            pendingValue = result.value;
            pendingResult = newPendingResult;

            if (sc) {
              sc.markPending(this, newPendingResult);
            }

            // Schedule trailing emit
            if (!timer && sc) {
              const delay = duration - (now - lastEmit);
              timer = setTimeout(() => flushPending(sc), delay);
            }
          }
        }

        // Source completed → flush trailing pending
        const sc = context?.currentStreamContext();
        if (pendingResult !== undefined && sc) {
          flushPending(sc);
        }
      } catch (err) {
        const sc = context?.currentStreamContext();
        if (pendingResult && sc) {
          sc.resolvePending(this, pendingResult);
        }
        output.error(err);
      } finally {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        output.complete();
      }
    })();

    return eachValueFrom(output);
  });
