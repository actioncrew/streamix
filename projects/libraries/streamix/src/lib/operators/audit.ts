import { eachValueFrom } from '@actioncrew/streamix';
import { createOperator, Operator } from '../abstractions';
import { createSubject } from '../streams';

export const audit = <T = any>(duration: number): Operator => {
  return createOperator<T>('audit', (source) => {
    const output = createSubject<T>();

    let lastValue: T | undefined = undefined;
    let timerActive = false;

    const startTimer = () => {
      timerActive = true;
      setTimeout(() => {
        if (lastValue !== undefined) {
          output.next(lastValue);
          lastValue = undefined;
        }
        timerActive = false;
      }, duration);
    };

    // Start processing the source
    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;

          lastValue = value;

          if (!timerActive) {
            startTimer();
          }
        }

        // If a value is still buffered after stream ends, emit it
        if (!timerActive && lastValue !== undefined) {
          output.next(lastValue);
        }

        output.complete();
      } catch (err) {
        output.error(err);
      }
    })();

    return eachValueFrom(output);
  });
};
