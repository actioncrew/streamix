import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function takeUntil<T>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let notifierEmitted = false;

    // Async generator to handle the input stream with takeUntil logic
    const processInputStream = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (notifierEmitted) return; // Stop processing if the notifier has emitted
          output.next(value); // Forward the value from the input stream
        }
      } catch (err) {
        output.error(err); // Propagate any error
      }
    };

    // Async generator to handle the notifier stream
    const processNotifierStream = async () => {
      try {
        for await (const _ of eachValueFrom(notifier)) {
          notifierEmitted = true; // Mark notifier as emitted
          output.complete(); // Complete the output stream
          break; // Stop processing further from the input stream
        }
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

  return createMapper('takeUntil', createSubject<T>(), operator);
}
