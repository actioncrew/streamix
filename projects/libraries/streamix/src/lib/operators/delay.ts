import { createMapper, Stream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

export function delay<T>(ms: number): StreamMapper {
  return createMapper('delay', createSubject<T>(), (input: Stream<T>, output: Subject<T>) => {

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
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
