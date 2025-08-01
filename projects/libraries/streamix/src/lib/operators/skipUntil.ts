import { createOperator, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Skips values from the source stream until the notifier emits.
 */
export function skipUntil<T = any>(notifier: Stream) {
  return createOperator<T, T>('skipUntil', (source) => {
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
          const { value, done } = await source.next();
          if (done) break;
          if (canEmit) output.next(value);
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
