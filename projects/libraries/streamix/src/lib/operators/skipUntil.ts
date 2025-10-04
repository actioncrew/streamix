import { createOperator, Operator, Stream } from '../abstractions';
import { eachValueFrom, fromAny } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that skips all values from the source stream until
 * a value is emitted by a `notifier` stream.
 *
 * This operator controls the flow of data based on an external signal. It initially
 * drops all values from the source stream. It also subscribes to a separate `notifier`
 * stream. When the notifier emits its first value, the operator's internal state
 * changes, allowing all subsequent values from the source stream to pass through.
 *
 * This is useful for delaying the start of a data-intensive process until a specific
 * condition is met, for example, waiting for a user to click a button or for
 * an application to finish loading.
 *
 * @template T The type of the values in the source and output streams.
 * @param notifier The stream that, upon its first emission, signals that the operator
 * should stop skipping values.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function skipUntil<T = any, R = T>(notifier: Stream<R> | Promise<R>) {
  return createOperator<T, T>('skipUntil', function (this: Operator, source: AsyncIterator<T>) {
    const output = createSubject<T>();
    let canEmit = false;

    // Subscribe to notifier
    const notifierSubscription = fromAny(notifier).subscribe({
      next: () => {
        canEmit = true;
        notifierSubscription.unsubscribe();
      },
      error: (err) => {
        notifierSubscription.unsubscribe();
        output.error(err);
        output.complete();
      },
      complete: () => {
        notifierSubscription.unsubscribe();
      },
    });

    // Process source
    (async () => {
      try {
        while (true) {
          const { done, value } = await source.next();
          if (done) break;
          if (canEmit) output.next(value);
        }
      } catch (err) {
        if (!output.completed()) output.error(err);
      } finally {
        output.complete();
        notifierSubscription.unsubscribe();
      }
    })();

    return eachValueFrom(output)[Symbol.asyncIterator]();
  });
}
