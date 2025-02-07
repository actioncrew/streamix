import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export function delay<T>(ms: number): StreamOperator {
  return createStreamOperator('delay', (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let pending = 0;
    let isCompleted = false;
    let lastEmissionPromise: Promise<void> = Promise.resolve();

    const subscription = input({
      next: (value) => {
        pending++;
        lastEmissionPromise = lastEmissionPromise.then(
          () =>
            new Promise<void>((resolve) => {
              setTimeout(() => {
                output.next(value);
                pending--;
                // If it's completed and there are no pending emissions, complete the stream
                if (isCompleted && pending === 0) {
                  output.complete();
                  subscription.unsubscribe();
                }
                resolve();
              }, ms);
            }),
        );
      },
      error: (err) => output.error(err),
      complete: () => {
        isCompleted = true;
        // Check if there are no pending emissions; if so, complete immediately
        lastEmissionPromise.then(() => {
          if (pending === 0) {
            output.complete();
            subscription.unsubscribe();
          }
        });
      },
    });

    return output;
  });
}
