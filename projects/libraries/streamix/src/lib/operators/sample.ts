import { createOperator, createStreamResult, Operator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

/**
 * Creates a stream operator that emits the most recent value from the source stream
 * at a fixed periodic interval while tracking pending and phantom states.
 *
 * Values that arrive faster than the period are considered phantoms if skipped,
 * and pending results are tracked in PipeContext until resolved or emitted.
 *
 * @template T The type of the values in the source and output streams.
 * @param period The time in milliseconds between each emission.
 * @returns An Operator instance for use in a stream's `pipe` method.
 */

export const sample = <T = any>(period: number) =>
  createOperator<T, T>('sample', function (this: Operator, source, context) {
    const output: Subject<T> = createSubject<T>();

    let lastValue: T | undefined;
    let lastResult: any = undefined;
    let skipped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startSampling = (sc: any) => {
      intervalId = setInterval(() => {
        if (lastValue === undefined || lastResult === undefined) return;

        if (skipped) {
          // Mark as phantom if the last value was skipped
          sc?.markPhantom(this, lastResult);
        } else {
          output.next(lastValue);
          sc?.resolvePending(this, lastResult);
        }

        skipped = true;
      }, period);
    };

    const stopSampling = () => {
      if (intervalId !== null) clearInterval(intervalId);
      intervalId = null;
    };

    (async () => {
      try {
        const initialSc = context?.currentStreamContext();
        if (initialSc) {
          startSampling(initialSc);
        }

        while (true) {
          const sc = context?.currentStreamContext();
          const result = await source.next();

          if (result.done) break;

          // Create proper pending result
          const pendingResult = createStreamResult({
            value: result.value,
            done: false
          });

          // Previous lastResult becomes phantom if it existed and was skipped
          if (lastResult && skipped && sc) {
            sc.markPhantom(this, lastResult);
          }

          // Track new result as pending
          lastValue = result.value;
          lastResult = pendingResult;

          if (sc) {
            sc.markPending(this, pendingResult);
          }
          skipped = false;
        }

        // Emit final value
        const finalSc = context?.currentStreamContext();
        if (lastValue !== undefined && lastResult !== undefined && finalSc) {
          output.next(lastValue);
          finalSc.resolvePending(this, lastResult);
        }
      } catch (err) {
        // CORRECT: Get current context for error handling
        const sc = context?.currentStreamContext();
        if (lastResult && sc) {
          sc.resolvePending(this, lastResult);
        }
        output.error(err);
      } finally {
        stopSampling();
        output.complete();
      }
    })();

    return eachValueFrom(output);
  });
