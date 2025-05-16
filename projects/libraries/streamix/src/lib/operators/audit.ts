import { createOperator } from "../abstractions"; // your updated factory

export const audit = (duration: number) =>
  createOperator("audit", (source) => {
    let lastEmittedTime = 0;
    let lastSeenValue: any = undefined;

    return {
      async next() {
        while (true) {
          const result = await source.next();
          if (result.done) return result;

          const now = Date.now();

          // If enough time has passed since last emitted value, emit this
          if (now - lastEmittedTime >= duration) {
            lastEmittedTime = now;
            return { done: false, value: result.value };
          }

          // Otherwise: skip, but remember latest
          lastSeenValue = result.value;
        }
      }
    };
  });
