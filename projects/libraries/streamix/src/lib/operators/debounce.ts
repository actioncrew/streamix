import { createOperator, createStreamResult, Operator } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

/**
 * Creates a stream operator that emits the most recent value from the source stream
 * only after a specified duration has passed without another new value.
 *
 * This version tracks pending results in the PipeContext and marks
 * superseded values as phantoms.
 *
 * @template T The type of the values in the source and output streams.
 * @param duration The debounce duration in milliseconds.
 * @returns An Operator instance for use in a stream pipeline.
 */

export function debounce<T = any>(duration: number) {
  return createOperator<T, T>("debounce", function (this: Operator, source, context) {
    const output: Subject<T> = createSubject<T>();
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
    let latestValue: T | undefined = undefined;
    let latestResult: any = undefined;
    let isCompleted = false;

    const flush = (sc: any) => {
      if (latestValue !== undefined && latestResult !== undefined) {
        // Emit the latest value
        output.next(latestValue);

        // Resolve pending in context
        sc?.resolvePending(this, latestResult);

        latestValue = undefined;
        latestResult = undefined;
      }
      timeoutId = undefined;

      // If the source has completed, complete the output stream
      if (isCompleted) {
        output.complete();
      }
    };

    (async () => {
      try {
        while (true) {
          // CORRECT: Get current context inside the loop
          const sc = context?.currentStreamContext();

          // CORRECT: source.next() already returns StreamResult
          const result = await source.next();

          if (result.done) {
            isCompleted = true;

            // If a pending value exists, flush it before completing
            if (timeoutId === undefined && latestResult !== undefined && sc) {
              flush(sc);
            }
            break;
          }

          // If a pending value exists and the timer is active, mark it as phantom
          if (timeoutId !== undefined && latestResult !== undefined && sc) {
            sc.markPhantom(this, latestResult);
          }

          // Create proper pending result for the new value
          const pendingResult = createStreamResult({
            value: result.value,
            done: false
          });

          // Add the new result to pending set
          latestValue = result.value;
          latestResult = pendingResult;

          if (sc) {
            sc.markPending(this, pendingResult);
          }

          // Reset the timer
          if (timeoutId !== undefined) clearTimeout(timeoutId);
          if (sc) {
            timeoutId = setTimeout(() => flush(sc), duration);
          }
        }
      } catch (err) {
        const sc = context?.currentStreamContext();
        if (latestResult && sc) {
          sc.resolvePending(this, latestResult);
        }
        output.error(err);
      } finally {
        isCompleted = true;
        // Clear pending timer
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        // Flush any remaining latest value
        const sc = context?.currentStreamContext();
        if (latestResult !== undefined && sc) {
          flush(sc);
        }
        output.complete();
      }
    })();

    return eachValueFrom<T>(output);
  });
}
