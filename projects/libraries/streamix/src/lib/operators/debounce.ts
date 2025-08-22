import { createOperator } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

/**
 * Creates a stream operator that emits the most recent value from the source stream
 * only after a specified duration has passed without another new value.
 *
 * This operator is a classic debounce function applied to a stream. It's useful for
 * reducing the rate of events that occur in rapid succession, such as user input
 * or window resizing. Each time a new value arrives, a timer is reset. The value is
 * emitted only if the timer completes without being reset.
 *
 * @template T The type of the values in the source and output streams.
 * @param duration The time in milliseconds to wait for inactivity before emitting a value.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function debounce<T = any>(duration: number) {
  return createOperator<T, T>("debounce", (source) => {
    let output = createSubject<T>();
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
          if (result.phantom) continue;

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
