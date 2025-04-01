import { createMapper, Stream, StreamMapper, Subscription } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, interval } from "../streams";

export function audit<T = any>(duration: number): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let lastValue: T | undefined;
    let timerSubscription: Subscription | null = null;
    let inputCompleted = false;

    const clearTimer = () => {
      if (timerSubscription) {
        timerSubscription.unsubscribe();
        timerSubscription = null;
      }
    };

    const startNewTimer = () => {
      clearTimer();

      const timer = interval(duration);
      timerSubscription = timer.subscribe({
        next: () => {
          if (lastValue !== undefined) {
            output.next(lastValue);
            lastValue = undefined;
            clearTimer();

            if (inputCompleted) {
              output.complete();
            }
          }
        },
        error: (err) => output.error(err)
      });
    };

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          lastValue = value;
          if (!timerSubscription) {
            startNewTimer();
          }
        }

        inputCompleted = true;
        if (!timerSubscription && lastValue !== undefined) {
          output.next(lastValue);
          output.complete();
        }
      } catch (err) {
        output.error(err);
      } finally {
        clearTimer();
      }
    })();

    return output;
  };

  return createMapper('audit', operator);
}
