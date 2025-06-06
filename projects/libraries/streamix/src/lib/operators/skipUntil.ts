import { createOperator, Operator, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

export function skipUntil<T = any>(notifier: Stream): Operator {
  return createOperator('skipUntil', (source) => {
    const output = createSubject<T>();
    let canEmit = false;

    // Subscribe to notifier as an async iterator
     let notifierSubscription = notifier.subscribe({
      next: () => {
        canEmit = true;
        notifierSubscription.unsubscribe();
      },
      error: (err: any) => {
        notifierSubscription.unsubscribe();
        output.error(err);
      },
      complete: () => {
        notifierSubscription.unsubscribe();
      },
    });


    // Process source async iterator
    (async () => {
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
    })();

    return eachValueFrom(output);
  });
}
