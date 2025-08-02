import { createOperator } from "../abstractions";

/**
 * Buffers a fixed number of values from the source stream and emits them as arrays.
 * Emits when the buffer reaches the specified size or when the source completes.
 */
export const bufferCount = <T = any>(bufferSize: number = Infinity) =>
  createOperator<T, T[]>("bufferCount", (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<T[]>> {
        if (done) return { done: true, value: undefined };

        const buffer: any[] = [];

        while (buffer.length < bufferSize) {
          const { done: sourceDone, value } = await source.next();

          if (sourceDone) {
            done = true;
            // Emit any remaining buffered items before completing
            return buffer.length > 0
              ? { done: false, value: buffer }
              : { done: true, value: undefined };
          }

          buffer.push(value);
        }

        // Buffer full, emit it
        return { done: false, value: buffer };
      }
    };
  });
