import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function delayUntil<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let canEmit = false;
    let buffer: T[] = [];

    const notifierSubscription = notifier.subscribe({
      next: () => {
        canEmit = true;
        buffer.forEach(v => output.next(v));
        buffer = [];
        notifierSubscription.unsubscribe();
      },
      complete: () => {
        notifierSubscription.unsubscribe();
      },
      error: (err) => {
        output.error(err);
      },
    });

    const processInput = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (canEmit) {
            output.next(value);
          } else {
            buffer.push(value);
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    };

    processInput();
  };

  return createMapper('delayUntil', createSubject<T>(), operator);
}
