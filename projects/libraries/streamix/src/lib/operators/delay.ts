import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

export function delay<T = any>(ms: number) {
  return createOperator<T, T>('delay', (source) => {
    const output = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;

          await new Promise((resolve) => setTimeout(resolve, ms)); // Delay before forwarding
          output.next(result.value);
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
}
