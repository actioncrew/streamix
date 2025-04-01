import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function sampleWhen<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let lastValue: T | undefined;

    // Async generator to handle the input stream
    const processInputStream = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          lastValue = value; // Store the latest value from the input stream
        }
      } catch (err) {
        output.error(err); // Propagate any error
      }
    };

    // Async generator to handle the notifier stream
    const processNotifierStream = async () => {
      try {
        for await (const _ of eachValueFrom(notifier)) {
          if (lastValue !== undefined) {
            output.next(lastValue); // Emit the last value when notifier emits
          }
        }
        // When notifier completes, complete the output
        output.complete();
      } catch (err) {
        output.error(err); // Propagate any error from the notifier stream
      }
    };

    // Run both input stream and notifier stream concurrently
    (async () => {
      await Promise.all([processInputStream(), processNotifierStream()]);
    })();

    return output;
  };

  return createMapper('sampleWhen', operator);
}
