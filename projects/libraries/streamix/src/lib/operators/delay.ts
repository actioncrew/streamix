import { eachValueFrom } from '@actioncrew/streamix';
import { createOperator } from '../abstractions';
import { createSubject } from '../streams';

export function delay<T>(ms: number) {
  return createOperator('delay', (source) => {
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

    return eachValueFrom(output);
  });
}
