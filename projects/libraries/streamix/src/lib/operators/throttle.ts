import { createOperator, createStreamResult, StreamResult } from '../abstractions';
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
  createOperator<T, T>('throttle', (source, context) => {
    const output: Subject<T> = createSubject<T>();
    let lastEmit = 0;
    let pendingResult: StreamResult<T> | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flushPending = () => {
      if (pendingResult !== undefined) {
        output.next(pendingResult.value!);
        context.resolvePending(pendingResult);
        pendingResult = undefined;
      }
      timer = null;
      lastEmit = Date.now();
    };

    (async () => {
      try {
        while (true) {
          const result: StreamResult<T> = createStreamResult(await source.next());
          if (result.done) break;

          const now = Date.now();
          if (now - lastEmit >= duration) {
            // Emit immediately
            output.next(result.value);
            lastEmit = now;
          } else {
            // Previous value is superseded → phantom if any
            if (pendingResult !== undefined) {
              context.markPhantom(pendingResult);
            }

            // Add current value as pending
            context.pendingResults.add(result);
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
        if (pendingResult) context.pendingResults.delete(pendingResult);
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
