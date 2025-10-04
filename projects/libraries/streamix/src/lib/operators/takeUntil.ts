import { createOperator, Operator, Stream } from '../abstractions';
import { eachValueFrom, fromAny } from '../converters';
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
export function takeUntil<T = any, R = T>(notifier: Stream<R> | Promise<R>) {
  return createOperator<T, T>('takeUntil', function (this: Operator, source: AsyncIterator<T>) {
    const output = createSubject<T>();
    let stop = false;

    const notifierSubscription = fromAny(notifier).subscribe({
      next: () => { stop = true; notifierSubscription.unsubscribe(); output.complete(); },
      error: (err) => { stop = true; notifierSubscription.unsubscribe(); output.error(err); output.complete(); },
      complete: () => { notifierSubscription.unsubscribe(); },
    });

    (async () => {
      try {
        while (!stop) {
          const { done, value } = await source.next();
          if (done || stop) break;
          output.next(value);
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
