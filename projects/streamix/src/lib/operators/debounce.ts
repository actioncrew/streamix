import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams/subject";

export function debounce<T>(duration: number): StreamOperator {
  return createStreamOperator("debounce", (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();

    (async () => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let latestValue: T | null = null;
      let isCompleted = false;
      let emissionCount = 0;

      try {
        for await (const emission of input) {
          emissionCount++;
          latestValue = emission.value!;

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
        }
      } catch (err) {
        output.error(err);
      } finally {
        isCompleted = true;

        if (timeoutId === null) {
          if (emissionCount > 1 && latestValue !== null) {
            output.next(latestValue);
          }
          output.complete();
        }
      }
    })();

    return output;
  });
}
