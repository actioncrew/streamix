import { Stream } from "../abstractions";

export async function* eachValueFrom<T = any>(stream: Stream<T>): AsyncGenerator<T> {
  let resolveNext: ((value: T | undefined) => void) | null = null;
  let rejectNext: ((error: any) => void) | null = null;
  let completed = false;
  let error: any = null;
  const queue: T[] = [];

  const subscription = stream.subscribe({
    next(value) {
      if (resolveNext) {
        resolveNext(value);
        resolveNext = null;
        rejectNext = null;
      } else {
        queue.push(value);
      }
    },
    error(err) {
      error = err;
      if (rejectNext) {
        rejectNext(err);
        resolveNext = null;
        rejectNext = null;
      }
    },
    complete() {
      completed = true;
      if (resolveNext) {
        resolveNext(undefined);
        resolveNext = null;
        rejectNext = null;
      }
    }
  });

  try {
    while (!completed || queue.length > 0) {
      if (error) throw error;

      if (queue.length > 0) {
        yield queue.shift()!;
      } else if (!completed) {
        try {
          const next = await new Promise<T | undefined>((resolve, reject) => {
            resolveNext = resolve;
            rejectNext = reject;
          });

          if (next !== undefined) yield next;
        } catch (err) {
          error = err;
          throw err;
        }
      }
    }
  } finally {
    subscription.unsubscribe();
  }
}
