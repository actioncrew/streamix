import { createMapper, createSubject, Stream, StreamMapper } from '../abstractions';
import { createSubject } from '../streams';

export function last(): StreamMapper {
  return createMapper('last', (input: Stream) => {
    const output = createSubject();
    let lastValue: any;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          lastValue = value;
        }
        if (lastValue !== undefined) {
          output.next(lastValue);
        }
        output.complete();
      } catch (err) {
        output.error(err);
      }
    })();

    return output;
  });
}
