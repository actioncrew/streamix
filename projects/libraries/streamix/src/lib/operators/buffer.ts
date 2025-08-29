import { createOperator, createStreamResult, Operator } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, timer } from "../streams";

/**
 * Buffers values from the source stream and emits them as arrays every `period` milliseconds,
 * while tracking pending and phantom values in the PipeContext.
 *
 * @template T The type of the values in the source stream.
 * @param period Time in milliseconds between each buffer flush.
 * @returns An Operator instance for use in a stream's `pipe` method.
 */
export function buffer<T = any>(period: number) {
  return createOperator<T, T[]>("buffer", function (this: Operator, source, context) {
    const output = createSubject<T[]>();
    let buffer: T[] = [];
    let completed = false;

    const flush = () => {
      if (buffer.length > 0) {
        output.next(buffer);
        buffer = [];
      }
    };

    const cleanup = () => {
      intervalSubscription.unsubscribe();
    };

    const flushAndComplete = () => {
      flush();
      if (!completed) {
        completed = true;
        output.complete();
      }
      cleanup();
    };

    const fail = (err: any) => {
      output.error(err);
      cleanup();
    };

    // Timer triggers periodic flush
    const intervalSubscription = timer(period, period).subscribe({
      next: () => flush(),
      error: (err) => fail(err),
      complete: () => flushAndComplete(),
    });

    (async () => {
      try {
        while (true) {
          // CORRECT: Get current stream context INSIDE the processing loop
          const sc = context?.currentStreamContext();

          const result = await source.next();
          if (result.done) break;

          // Mark this value as pending in the context
          if (sc) {
            const pendingResult = createStreamResult({
              value: result.value,
              done: false
            });
            sc.markPending(this, pendingResult);
          }

          // Add to buffer
          buffer.push(result.value);
        }
      } catch (err) {
        // CORRECT: Get current context for error handling too
        const sc = context?.currentStreamContext();
        if (sc && buffer.length > 0) {
          buffer.forEach(value => {
            const phantomResult = createStreamResult({
              value: value,
              type: 'phantom',
              done: true
            });
            sc.markPhantom(this, phantomResult);
          });
        }
        output.error(err);
      } finally {
        flushAndComplete();
      }
    })();

    return eachValueFrom<T[]>(output);
  });
}
