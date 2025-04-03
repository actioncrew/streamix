import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function count(): StreamMapper {
  const operator = (input: Stream<any>): Stream<number> => {
    const output = createSubject<number>();

    (async () => {
      let count = 0;
      try {
        for await (const _ of eachValueFrom(input)) {
          void _;
          count++;
        }
        output.next(count);
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    return output;
  };

  return createMapper('count', operator);
}
