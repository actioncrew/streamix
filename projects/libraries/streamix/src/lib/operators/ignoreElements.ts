import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function ignoreElements<T>(): StreamMapper {
  const operator = (input: Stream<T>, output: Subject)  => {
    (async () => {
      try {
        // Consume all values but don't emit them
        for await (const _ of eachValueFrom(input)) {
          // Intentionally empty - we're ignoring all values
        }
        output.complete();
      } catch (err) {
        output.error(err); // Only errors get propagated
      }
    })();
  };

  return createMapper('ignoreElements', createSubject<never>(), operator);
}
