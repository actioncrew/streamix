import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

export const throttle = <T = any>(duration: number) =>
  createOperator<T, T>('throttle', (source) => {
    const output = createSubject<T>();

    let lastEmit = 0;
    let pending: T | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flushPending = () => {
      if (pending !== undefined) {
        lastEmit = Date.now();
        output.next(pending);
        pending = undefined;
      }
    };

    (async () => {
      try {
        for (;;) {
          const { value, done } = await source.next();
          if (done) break;

          const now = Date.now();
          if (now - lastEmit >= duration) {
            lastEmit = now;
            output.next(value);
          } else {
            pending = value;
            if (!timer) {
              timer = setTimeout(() => {
                flushPending();
                timer = null;
              }, duration - (now - lastEmit));
            }
          }
        }

        if (pending !== undefined) flushPending(); // final trailing emit
      } catch (err) {
        output.error(err);
      } finally {
        if (timer) clearTimeout(timer);
        output.complete();
      }
    })();

    return eachValueFrom(output)[Symbol.asyncIterator]();
  });
