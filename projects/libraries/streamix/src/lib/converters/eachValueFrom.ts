import { Stream } from "../abstractions";

/**
 * Converts a `Stream` into an async generator, yielding each emitted value.
 *
 * This function creates a bridge between the push-based nature of a stream and
 * the pull-based nature of an async generator. It subscribes to the stream and
 * buffers incoming values in a queue. When the generator is iterated over
 * (e.g., in a `for await...of` loop), it first yields any buffered values
 * before asynchronously waiting for the next value to be pushed.
 *
 * The generator handles all stream events:
 * - Each yielded value corresponds to a `next` event.
 * - The generator terminates when the stream `complete`s.
 * - It throws an error if the stream emits an `error` event.
 *
 * It correctly handles situations where the stream completes or errors out
 * before any values are yielded, and ensures the subscription is
 * always cleaned up.
 *
 * @template T The type of the values emitted by the stream.
 * @param stream The source stream to convert.
 * @returns An async generator that yields the values from the stream.
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
