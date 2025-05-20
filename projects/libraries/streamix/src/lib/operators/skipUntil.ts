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
        output.complete();
      } catch (err) {
        if (!output.completed()) output.error(err);
      }
    })();

    return eachValueFrom(output);
  });
}
