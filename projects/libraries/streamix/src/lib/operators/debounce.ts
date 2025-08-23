import { createOperator } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

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
    // Create a subject to act as the output stream.
    // We use a subject because we need to manually control when values are emitted.
    let output: Subject<T> = createSubject<T>();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let latestValue: T | null = null;
    let isCompleted = false;

    // A flag to check if we've received any values at all.
    let hasReceivedValues = false;

    // The function that will emit the latest value and reset the timer.
    const flush = () => {
      // Check if there is a pending value to emit.
      if (latestValue !== null) {
        // Emit the last received value as a normal stream value.
        output.next(latestValue);
        latestValue = null;
      }
      timeoutId = null;

      // If the source stream has completed and there are no pending values,
      // we can complete the output subject.
      if (isCompleted) {
        output.complete();
      }
    };

    // An IIFE to handle the input stream asynchronously.
    (async () => {
      try {
        while (true) {
          // Await the next result from the source stream.
          const result = await source.next();
          if (result.done) break;

          // If a value was already waiting to be emitted, the new value
          // will cause it to be dropped. We signal this with a phantom.
          if (latestValue !== null) {
            output.phantom(latestValue);
          }

          hasReceivedValues = true;
          latestValue = result.value;

          // Reset the timer with a new one.
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(flush, duration);
        }
        // If the source stream completes, we mark our state as completed.
      } catch (err) {
        // If an error occurs, clear the timer and forward the error.
        if (timeoutId) clearTimeout(timeoutId);
        output.error(err);
      } finally {
        // Mark as completed, but do not complete the output stream yet if a timer is pending.
        isCompleted = true;

        // If there's no pending timer, we can complete the stream immediately.
        if (!timeoutId) {
          // If a value was received but the timer never fired (e.g., stream completed quickly),
          // flush the last value before completing.
          if (hasReceivedValues && latestValue !== null) {
            flush();
          }
          output.complete();
        }
      }
    })();

    // Expose the output subject as an AsyncIterator.
    const iterable = eachValueFrom(output);
    return iterable[Symbol.asyncIterator]();
  });
}
