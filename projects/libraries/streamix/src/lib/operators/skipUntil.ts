import { createOperator, Operator, Stream } from '../abstractions';

export const skipUntil = <T = any>(notifier: Stream<any>): Operator => {
  return createOperator('skipUntil', (source) => {
    let canEmit = false;
    let notifierResolved = false;
    let resolveCanEmit: () => void;

    const canEmitPromise = new Promise<void>((resolve) => {
      resolveCanEmit = resolve;
    });

    const notifierSubscription = notifier.subscribe({
      next: () => {
        if (!canEmit) {
          canEmit = true;
          notifierResolved = true;
          resolveCanEmit();
          notifierSubscription.unsubscribe();
        }
      },
      error: (_: any) => {
        notifierResolved = true;
        resolveCanEmit();
        // No propagation of error here because we're inside an Operator —
        // we let source decide what to do with errors, or optionally log them.
      },
      complete: () => {
        if (!canEmit) {
          canEmit = true;
          notifierResolved = true;
          resolveCanEmit();
        }
        notifierSubscription.unsubscribe();
      }
    });

    return {
      async next(): Promise<IteratorResult<T>> {
        // Wait until canEmit is true
        if (!canEmit && !notifierResolved) {
          await canEmitPromise;
        }

        const result = await source.next();
        if (result.done) return result;

        return canEmit
          ? result
          : await this.next(); // Skip this value if canEmit is still false
      },
    };
  });
};
