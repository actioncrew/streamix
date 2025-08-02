import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Delays the emission of each item from the source stream
 * by scheduling it on the specified JavaScript task queue context.
 *
 * Supports `"microtask"` (via `queueMicrotask`) and `"macrotask"` (via `setTimeout`).
 */
export const observeOn = <T = any>(context: "microtask" | "macrotask") => {
  return createOperator<T, T>('observeOn', (source) => {
    const output = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;

          if (context === 'microtask') {
            queueMicrotask(() => output.next(value));
          } else {
            setTimeout(() => output.next(value));
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
};
