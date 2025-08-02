import { Stream } from "../abstractions";

/**
 * Converts a `Stream` into an async generator, yielding each emitted value.
 *
 * Values are yielded as they arrive. The generator ends on stream completion,
 * or throws on error. Buffered values are drained before waiting for new ones.
 */
export async function* eachValueFrom<T = any>(stream: Stream<T>): AsyncGenerator<T> {
  let resolveNext: ((value: T | undefined) => void) | null = null;
  let rejectNext: ((error: any) => void) | null = null;
  let completed = false;
  let error: any = null;
  const queue: T[] = [];

  const subscription = stream.subscribe({
    next(value: T) {
      if (resolveNext) {
        // Immediately fulfill waiting promise
        const r = resolveNext;
        resolveNext = null;
        rejectNext = null;
        r(value);
      } else {
        queue.push(value);
      }
    },
    error(err: any) {
      error = err;
      if (rejectNext) {
        const r = rejectNext;
        resolveNext = null;
        rejectNext = null;
        r(err);
      }
      subscription.unsubscribe();
    },
    complete() {
      completed = true;
      if (resolveNext) {
        // resolve with undefined to signal completion
        const r = resolveNext;
        resolveNext = null;
        rejectNext = null;
        r(undefined);
      }
      subscription.unsubscribe();
    }
  });

  try {
    while (true) {
      if (error) throw error;

      if (queue.length > 0) {
        yield queue.shift()!;
      } else if (completed) {
        // No more values expected and none buffered
        break;
      } else {
        // Wait for next value or completion/error
        try {
          const nextValue = await new Promise<T | undefined>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });

          if (nextValue === undefined) {
            // Stream completed
            break;
          } else {
            yield nextValue;
          }
        } catch (err) {
          error = err;
          throw error;
        }
      }
    }
  } finally {
    subscription.unsubscribe();
  }
}
