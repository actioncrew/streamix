import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

/**
 * Creates a stream operator that delays the emission of each value from the source stream.
 *
 * This operator introduces a delay of `ms` milliseconds before each value received from the
 * source is re-emitted. The values maintain their original order but are emitted
 * with a time gap between them.
 *
 * This is useful for simulating latency or for controlling the rate of events in a predictable
 * manner, such as for animations or staggered data loading.
 *
 * @template T The type of the values in the source and output streams.
 * @param ms The time in milliseconds to delay each value.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function delay<T = any>(ms: number) {
  return createOperator<T, T>('delay', (source, context) => {
    const output = createSubject<T>();

    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;
          if (result.phantom) { context.phantomHandler(result.value); continue; }

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
