import { createOperator, createStreamResult, Operator, StreamResult } from '../abstractions';
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
    const sc = context?.currentStreamContext();
    const output: Subject<T> = createSubject<T>();

    let lastResult: StreamResult<T> | undefined;
    let skipped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startSampling = () => {
      intervalId = setInterval(async () => {
        if (!lastResult) return;

        if (skipped) {
          // Mark as phantom if the last value was skipped
          sc?.markPhantom(this, lastResult);
        } else {
          output.next(lastResult.value!);
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
        startSampling();

        while (true) {
          const result: StreamResult<T> = createStreamResult(await source.next());
          if (result.done) break;

          // Previous lastResult becomes phantom if it existed and was skipped
          if (lastResult && skipped) {
            sc?.markPhantom(this, lastResult);
          }

          // Track new result as pending
          sc?.markPending(this, result);
          lastResult = result;
          skipped = false;
        }

        // Emit final value
        if (lastResult) {
          output.next(lastResult.value!);
          sc?.resolvePending(this, lastResult);
        }
      } catch (err) {
        if (lastResult) sc?.resolvePending(this, lastResult);
        output.error(err);
      } finally {
        stopSampling();
        output.complete();
      }
    })();

    return eachValueFrom(output)[Symbol.asyncIterator]();
  });
