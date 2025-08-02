import { createOperator, Operator } from "../abstractions";
import { eachValueFrom } from '../converters';
import { createSubject, timer } from "../streams";

/**
 * Buffers values from the source stream and emits them as arrays
 * every `period` milliseconds.
 *
 * Emits buffered values periodically and completes when the source completes.
 * Errors from source or timer propagate immediately.
 */
export function buffer<T = any>(period: number): Operator {
  return createOperator<T, T[]>('buffer', (source) => {
    const output = createSubject<T[]>();
    let buffer: T[] = [];
    let completed = false;

    const flush = () => {
      if (buffer.length > 0) {
        output.next([...buffer]);
        buffer = [];
      }
    };

    const cleanup = () => {
      intervalSubscription.unsubscribe();
    };

    const flushAndComplete = () => {
      flush();
      if (!completed) {
        completed = true;
        output.complete();
      }
      cleanup();
    };

    const intervalSubscription = timer(period, period).subscribe({
      next: () => flush(),
      error: (err) => {
        output.error(err);
        cleanup();
      },
      complete: () => flushAndComplete(),
    });

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;
          buffer.push(value);
        }
      } catch (err) {
        cleanup();
        output.error(err);
      } finally {
        flushAndComplete();
      }
    })();

    const iterable = eachValueFrom<T[]>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
