import { createOperator, createStreamResult, Operator, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';
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
export function skipUntil<T = any>(notifier: Stream) {
  return createOperator<T, T>('skipUntil', function (this: Operator, source, context) {
    const output = createSubject<T>();
    let canEmit = false;

    // Subscribe to notifier as an async iterator
    let notifierSubscription = notifier.subscribe({
      next: () => {
        canEmit = true;
        notifierSubscription.unsubscribe();
      },
      error: (err: any) => {
        output.error(err);
        notifierSubscription.unsubscribe();
      },
      complete: () => {
        notifierSubscription.unsubscribe();
      },
    });


    // Process source async iterator
    setTimeout(async () => {
      try {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) {
            output.complete();
            break;
          }

          if (canEmit) {
            output.next(result.value);
          } else {
            // If we are still skipping, emit a phantom value.
            await context?.markPhantom(this, result);
          }
        }
      } catch (err) {
        if (!output.completed()) output.error(err);
      } finally {
        output.complete();
      }
    }, 0);

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
