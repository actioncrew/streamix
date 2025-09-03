import { createOperator, createStreamResult, Operator, StreamResult } from "../abstractions";
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
    let pendingResults: StreamResult[] = []; // Track actual pending results
    let completed = false;

    const flush = () => {
      if (buffer.length > 0) {
        // Resolve all pending results for this buffer
        if (context && pendingResults.length > 0) {
          pendingResults.forEach(pendingResult => {
            context.resolvePending(this, pendingResult);
          });
          pendingResults = []; // Clear the tracking array
        }
        
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
      // Mark any remaining pending results as phantom
      if (context && pendingResults.length > 0) {
        pendingResults.forEach(pendingResult => {
          context.markPhantom(this, pendingResult);
        });
        pendingResults = [];
      }
      
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
          const result = await source.next();

          if (result.done) break;

          // Create and mark this value as pending in the context
          if (context) {
            const pendingResult = createStreamResult({
              value: result.value,
              done: false
            });
            context.markPending(this, pendingResult);
            pendingResults.push(pendingResult); // Keep reference to the actual pending result
          }

          // Add to buffer
          buffer.push(result.value);
        }
      } catch (err) {
        fail(err);
      } finally {
        flushAndComplete();
      }
    })();

    return eachValueFrom<T[]>(output)[Symbol.asyncIterator]();
  });
}