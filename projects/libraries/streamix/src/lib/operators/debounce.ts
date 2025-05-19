import { createOperator } from "../abstractions";

export const debounce = <T = any>(duration: number) =>
  createOperator("debounce", (source) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let currentValue: T | undefined;
    let done = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        while (!done) {
          const result = await source.next();
          if (result.done) {
            done = true;

            // Wait for any pending debounce timeout
            if (timeoutId) {
              await new Promise((resolve) => setTimeout(resolve, duration));
              timeoutId = null;
              return { done: false, value: currentValue! };
            }

            return { done: true, value: undefined };
          }

          currentValue = result.value;

          if (timeoutId) clearTimeout(timeoutId);

          // Delay emission and start a new debounce timer
          await new Promise<void>((resolve) => {
            timeoutId = setTimeout(resolve, duration);
          });

          return { done: false, value: currentValue! };
        }

        return { done: true, value: undefined };
      },
    };
  });
