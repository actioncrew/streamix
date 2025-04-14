import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function takeUntil<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let isStopped = false;

    const notifierSubscription = notifier.subscribe({
      next: () => {
        isStopped = true;
        output.complete();
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
          if (isStopped) break;
          output.next(value);
        }
      } catch (err) {
        output.error(err);
      } finally {
        if (!isStopped) output.complete();
      }
    };

    processInput();
  };

  return createMapper('takeUntil', createSubject<T>(), operator);
}
