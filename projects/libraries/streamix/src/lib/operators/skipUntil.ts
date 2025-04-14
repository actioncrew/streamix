import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function skipUntil<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let canEmit = false;

    let notifierSubscription = notifier.subscribe({
      next: () => {
        canEmit = true;
        notifierSubscription.unsubscribe();
      },
      complete: () => {
        notifierSubscription.unsubscribe();
      },
      error: (err) => {
        output.error(err);
      },
    });

    // Process the input stream
    const processInput = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (canEmit) {
            output.next(value);
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    };

    // Run both processors concurrently
    processInput();

    return output;
  };

  return createMapper('skipUntil', createSubject<T>(), operator);
}
