import { createOperator, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Emits values from the source until the notifier emits its first value.
 * Once the notifier emits, the output stream completes immediately.
 */
export function takeUntil<T = any>(notifier: Stream) {
  return createOperator<T, T>('takeUntil', (source) => {
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
          const { value, done } = await source.next();
          if (done || shouldStop) break;
          output.next(value);
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
