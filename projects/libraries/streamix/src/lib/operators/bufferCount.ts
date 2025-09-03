import { DONE, NEXT, Operator, StreamResult, createOperator, createStreamResult } from "../abstractions";

/**
 * Buffers a fixed number of values from the source stream and emits them as arrays,
 * tracking pending and phantom values in the PipeContext.
 *
 * @template T The type of values in the source stream.
 * @param bufferSize The maximum number of values per buffer (default: Infinity).
 * @returns An Operator instance for use in a stream's `pipe` method.
 */
export const bufferCount = <T = any>(bufferSize: number = Infinity) =>
  createOperator<T, T[]>("bufferCount", function (this: Operator, source, context) {
    let completed = false;

    return {
      next: async () => {
        if (completed) return DONE;

        const buffer: StreamResult[] = [];

        while (buffer.length < bufferSize) {
          const result = createStreamResult(await source.next());

          if (result.done) {
            completed = true;

            // Flush any remaining buffered values
            if (buffer.length > 0) {
              buffer.forEach((r) => context?.resolvePending(this, r));
              return NEXT(buffer.map((r) => r.value!));
            }

            return DONE;
          }

          // Mark the value as pending
          context?.markPending(this, result);
          buffer.push(result);
        }

        // Resolve all values in the buffer
        buffer.forEach((r) => context?.resolvePending(this, r));

        return NEXT(buffer.map((r) => r.value!));
      },
    };
  });
