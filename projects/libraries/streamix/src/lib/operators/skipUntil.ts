import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function skipUntil<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let canEmit = false;

    // Process the notifier stream
    const processNotifier = async () => {
      try {
        // Wait for first emission from notifier
        await eachValueFrom(notifier).next();
        canEmit = true; // Now we can emit values
      } catch (err) {
        output.error(err);
      }
    };

    // Process the input stream
    const processInput = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (canEmit) {
            output.next(value);
          }
        }
        output.complete();
      } catch (err) {
        if (canEmit) {
          output.error(err);
        }
      }
    };

    // Run both processors concurrently
    (async () => {
      await Promise.all([processNotifier(), processInput()]);
    })();

    return output;
  };

  return createMapper('skipUntil', createSubject<T>(), operator);
}
