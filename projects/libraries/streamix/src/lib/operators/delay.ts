import { createMapper, Stream, StreamMapper } from '../abstractions';
import { createSubject } from '../streams';

export function delay<T>(ms: number): StreamMapper {
  return createMapper('delay', (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();

    (async () => {
      try {
        for await (const value of input) {
          await new Promise((resolve) => setTimeout(resolve, ms)); // Delay before forwarding
          output.next(value);
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    return output;
  });
}
