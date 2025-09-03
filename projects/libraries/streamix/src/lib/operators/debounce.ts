import { createOperator, createStreamResult, Operator, StreamResult } from "../abstractions";
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
    let latestResult: StreamResult | undefined = undefined;
    let isCompleted = false;

    const flush = () => {
      if (latestResult !== undefined) {
        // Emit the latest value
        output.next(latestResult.value!);

        // Resolve pending in context
        context?.resolvePending(this, latestResult);

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
          const result = createStreamResult(await source.next());

          if (result.done) {
            isCompleted = true;

            // If a pending value exists, flush it before completing
            if (timeoutId === undefined && latestResult !== undefined) {
              flush();
            }
            break;
          }

          // If a pending value exists and the timer is active, mark it as phantom
          if (timeoutId !== undefined && latestResult !== undefined) {
            context?.markPhantom(this, latestResult);
          }

          // Add the new result to pending set
          context?.markPending(this, result);
          latestResult = result;

          // Reset the timer
          if (timeoutId !== undefined) clearTimeout(timeoutId);
          timeoutId = setTimeout(flush, duration);
        }
      } catch (err) {
        if (latestResult) context?.resolvePending(this, latestResult);
        output.error(err);
      } finally {
        isCompleted = true;
        // Clear pending timer
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        // Flush any remaining latest value
        if (latestResult !== undefined) flush();
        output.complete();
      }
    })();

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
