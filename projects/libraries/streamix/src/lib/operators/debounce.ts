import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function debounce<T = any>(duration: number): StreamMapper {
  return createMapper("debounce", createSubject<T>(), (input: Stream<T>, output: Subject<T>) => {
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
        for await (const value of eachValueFrom(input)) {
          hasValues = true;
          latestValue = value;

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
  });
}
