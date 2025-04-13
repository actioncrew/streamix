import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function last<T = any>(
  predicate?: (value: T) => boolean
): StreamMapper {
  return createMapper('last', createSubject<T>(), (input: Stream<T>, output: Subject<T>) => {
    let lastValue: T | undefined;
    let hasMatch = false;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (!predicate || predicate(value)) {
            lastValue = value;
            hasMatch = true;
          }
        }

        if (hasMatch) {
          output.next(lastValue!);
        } else {
          throw new Error("No elements in sequence");
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();
  });
}
