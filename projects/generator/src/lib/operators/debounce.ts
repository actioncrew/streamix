import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams/subject";

export function debounce<T>(duration: number): StreamOperator {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let latestValue: T | null = null;
    let isCompleted = false;

    input.subscribe({
      next: (value) => {
        latestValue = value;

        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          if (latestValue !== null) {
            output.next(latestValue);

            if (isCompleted) {
              output.complete();
            }
          }
          timeoutId = null;
        }, duration);
      },
      error: (err) => output.error(err),
      complete: () => {
        isCompleted = true;

        if (timeoutId === null) {
          output.complete();
        }
      },
    });

    return output;
  };

  return createStreamOperator('debounce', operator);
}
