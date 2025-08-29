import { createOperator, createStreamResult, Operator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

/**
 * Creates a stream operator that delays the emission of each value from the source stream
 * while tracking pending and phantom states.
 *
 * Each value received from the source is added to `sc?.pendingResults` and is only
 * resolved once the delay has elapsed and the value is emitted downstream.
 *
 * @template T The type of the values in the source and output streams.
 * @param ms The time in milliseconds to delay each value.
 * @returns An Operator instance for use in a stream's `pipe` method.
 */

export function delay<T = any>(ms: number) {
  return createOperator<T, T>('delay', function (this: Operator, source, context) {
    const output: Subject<T> = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const result = await source.next();

          if (result.done) break;

          // Create proper pending result
          const pendingResult = createStreamResult({
            value: result.value,
            done: false
          });

          // Mark the value as pending
          if (context) {
            context.markPending(this, pendingResult);
          }

          // Delay emission
          await new Promise((resolve) => setTimeout(resolve, ms));

          // Emit downstream
          output.next(result.value);

          // Resolve pending state
          if (context) {
            context.resolvePending(this, pendingResult);
          }
        }
      } catch (err) {
        if (context) {
          // Resolve all pending results on error
          Array.from(context.pendingResults).forEach((res) => {
            context.resolvePending(this, res);
          });
        }
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    return eachValueFrom(output);
  });
}
