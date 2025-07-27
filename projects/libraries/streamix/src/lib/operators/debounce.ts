import { createOperator } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function debounce<T = any>(duration: number) {
  return createOperator("debounce", (source) => {
    let output = createSubject();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let latestValue: T | null = null;
    let hasValues = false;
    let isCompleted = false;

    const flush = () => {
      if (latestValue !== null) {
        output.next(latestValue);
        latestValue = null;
      }
      timeoutId = null;

      // Complete if we finished processing
      if (isCompleted) {
        output.complete();
      }
    };

    // Handle input stream
    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;

          latestValue = result.value;

          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(flush, duration);
        }
        // Otherwise wait for flush() to handle completion
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        output.error(err);
      } finally {
        // Mark as completed
        isCompleted = true;

        // If no pending timer, complete immediately
        if (!timeoutId) {
          // Only emit if we got values but no pending timer
          if (hasValues && latestValue !== null) {
            flush();
          }
          output.complete();
        }
      }
    })();

    const iterable = eachValueFrom(output);
    return iterable[Symbol.asyncIterator]();
  });
}
