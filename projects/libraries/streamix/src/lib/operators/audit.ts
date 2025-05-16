import { createOperator } from "../abstractions";

export const audit = (duration: number) =>
  createOperator("audit", (source) => {
    let lastValue: any = undefined;
    let timerStart: number | null = null;
    let timeoutPromise: Promise<void> | null = null;

    const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

    return {
      async next() {
        if (!timeoutPromise) {
          const result = source.next();
          if (result.done) return result;

          lastValue = result.value;
          timerStart = Date.now();
          timeoutPromise = wait(duration);
          await timeoutPromise;

          const valueToReturn = lastValue;
          lastValue = undefined;
          timeoutPromise = null;
          return { done: false, value: valueToReturn };
        }

        // Timer in progress, discard interim values
        while (true) {
          const result = source.next();
          if (result.done) return result;
          lastValue = result.value;

          const elapsed = Date.now() - (timerStart || 0);
          const remaining = duration - elapsed;
          if (remaining > 0) {
            await wait(remaining);
          }

          const valueToReturn = lastValue;
          lastValue = undefined;
          timeoutPromise = null;
          return { done: false, value: valueToReturn };
        }
      }
    };
  });
