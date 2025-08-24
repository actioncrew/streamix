import { createOperator, createStreamResult, Operator, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that emits all values from the source stream until
 * a value is emitted by a `notifier` stream.
 *
 * This operator controls the lifespan of a stream based on an external signal.
 * It consumes and re-emits values from the source until the `notifier` stream
 * emits its first value. As soon as that happens, the operator completes the
 * output stream and unsubscribes from both the source and the notifier.
 *
 * This is useful for automatically stopping an operation when a certain condition
 * is met, such as waiting for a user to close a dialog or for an animation to complete.
 *
 * @template T The type of the values in the source and output streams.
 * @param notifier The stream that, upon its first emission, signals that the operator
 * should complete.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */

/**
 * Creates a stream operator that emits all values from the source stream until
 * a value is emitted by a `notifier` stream.
 *
 * This operator controls the lifespan of a stream based on an external signal.
 * It consumes and re-emits values from the source until the `notifier` stream
 * emits its first value. As soon as that happens, the operator completes the
 * output stream and unsubscribes from both the source and the notifier.
 *
 * Phantom values are forwarded downstream as `{ value, phantom: true }`,
 * preserving the semantics of skipped or suppressed emissions.
 *
 * @template T The type of the values in the source and output streams.
 * @param notifier The stream that, upon its first emission, signals that the operator
 * should complete.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function takeUntil<T = any>(notifier: Stream) {
  return createOperator<T, T>('takeUntil', function (this: Operator, source) {
    const output = createSubject<T>();
    let shouldStop = false;

    // Subscribe to the notifier
    const notifierSubscription = notifier.subscribe({
      next: () => {
        shouldStop = true;
        notifierSubscription.unsubscribe();
      },
      error: (err) => {
        if (!output.completed()) output.error(err);
        notifierSubscription.unsubscribe();
      },
      complete: () => {
        notifierSubscription.unsubscribe();
      },
    });

    // Process source stream asynchronously
    setTimeout(async () => {
      try {
        while (!shouldStop) {
          const result = createStreamResult(await source.next());
          if (result.done || shouldStop) break;

          output.next(result.value);
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
