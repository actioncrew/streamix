import { createOperator, createStreamResult, Operator, StreamContext, StreamResult } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that emits the latest value from the source stream
 * at most once per specified duration, while managing pending and phantom states.
 *
 * Every value is added to the PipeContext.pendingResults set. If a new value arrives
 * while the timer is active, the previous value is marked as phantom and removed
 * from pending. The last value is resolved when emitted downstream or upon completion.
 *
 * @template T The type of the values in the stream.
 * @param duration The time in milliseconds to wait before emitting the latest value.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */

export const audit = <T = any>(duration: number) =>
  createOperator<T, T>('audit', function (this: Operator, source, context) {
    const output = createSubject<T>();

    let lastValue: T | undefined = undefined;
    let lastResult: StreamResult<T> | undefined = undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined = undefined;

    const flush = (sc: StreamContext) => {
      if (lastValue !== undefined && lastResult !== undefined) {
        output.next(lastValue);
        sc.resolvePending(this, lastResult);
        lastValue = undefined;
        lastResult = undefined;
      }
      timerId = undefined;
    };

    const startTimer = (sc: StreamContext) => {
      timerId = setTimeout(() => flush(sc), duration);
    };

    (async () => {
      try {
        while (true) {
          // CORRECT: Get current context inside the loop
          const sc = context?.currentStreamContext();

          // CORRECT: source.next() already returns StreamResult
          const result = await source.next();

          // Stream completed
          if (result.done) {
            if (lastResult !== undefined && sc) {
              flush(sc);
            }
            break;
          }

          // If a previous value is still pending, mark it as phantom
          if (timerId !== undefined && lastResult !== undefined && sc) {
            sc.markPhantom(this, lastResult);
          }

          // Create proper pending result for the new value
          const pendingResult = createStreamResult({
            value: result.value,
            done: false
          });

          // Add new value to pending set and buffer it
          lastValue = result.value;
          lastResult = pendingResult;

          if (sc) {
            sc.markPending(this, pendingResult);
          }

          // Start a new timer if not active
          if (timerId === undefined && sc) {
            startTimer(sc);
          }
        }
      } catch (err) {
        const sc = context?.currentStreamContext();
        output.error(err);
        if (lastResult && sc) {
          sc.resolvePending(this, lastResult);
        }
      } finally {
        if (timerId !== undefined) {
          clearTimeout(timerId);
          timerId = undefined;
        }
        output.complete();
      }
    })();

    return eachValueFrom<T>(output);
  });
