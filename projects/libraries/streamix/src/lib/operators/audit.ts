import { createOperator, createStreamResult, Operator, StreamResult } from '../abstractions';
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

    let lastResult: StreamResult | undefined = undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined = undefined;

    const flush = () => {
      if (lastResult !== undefined) {
        output.next(lastResult.value!);
        context?.resolvePending(this, lastResult);
        lastResult = undefined;
      }
      timerId = undefined;
    };

    const startTimer = () => {
      timerId = setTimeout(() => flush(), duration);
    };

    (async () => {
      try {
        while (true) {
          const result = createStreamResult(await source.next());

          // Stream completed
          if (result.done) {
            if (lastResult !== undefined) {
              flush();
            }
            break;
          }

          // If a previous value is still pending, mark it as phantom
          if (timerId !== undefined && lastResult !== undefined) {
            context?.markPhantom(this, lastResult);
          }

          // Add new value to pending set and buffer it
          lastResult = result;
          context?.markPending(this, lastResult!);

          // Start a new timer if not active
          if (timerId === undefined) {
            startTimer();
          }
        }
      } catch (err) {
        output.error(err);
        if (lastResult) context?.resolvePending(this, lastResult);
      } finally {
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
