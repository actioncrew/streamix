import { createOperator } from "../abstractions";
import { createReplaySubject, ReplaySubject } from "../streams";

export function shareReplay<T>(bufferSize: number = Infinity) {
  let sharedSubject: ReplaySubject<T> | null = null;
  let isConnected = false;

  return createOperator<T>("shareReplay", (source) => {
    if (!sharedSubject) {
      sharedSubject = createReplaySubject<T>(bufferSize);
    }

    if (!isConnected) {
      isConnected = true;

      // Connect to source once
      (async () => {
        try {
          let result = await source.next();
          while (!result.done) {
            sharedSubject!.next(result.value);
            result = await source.next();
          }
          sharedSubject!.complete();
        } catch (err) {
          sharedSubject!.error(err);
        }
      })();
    }

    // Per-consumer state
    const queue: T[] = [];
    let isDone = false;
    let error: any = null;

    let notify: (() => void) | null = null;

    const subscription = sharedSubject.subscribe({
      next: (value) => {
        queue.push(value);
        if (notify) {
          notify();
          notify = null;
        }
      },
      complete: () => {
        isDone = true;
        if (notify) {
          notify();
          notify = null;
        }
      },
      error: (err) => {
        error = err;
        isDone = true;
        if (notify) {
          notify();
          notify = null;
        }
      }
    });

    return {
      async next(): Promise<IteratorResult<T>> {
        if (queue.length === 0 && !isDone && !error) {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
        }

        if (error) {
          subscription.unsubscribe();
          throw error;
        }

        if (queue.length > 0) {
          return { value: queue.shift()!, done: false };
        }

        subscription.unsubscribe();
        return { value: undefined, done: true };
      },

      async return(): Promise<IteratorResult<T>> {
        subscription.unsubscribe();
        return { value: undefined, done: true };
      }
    };
  });
}
