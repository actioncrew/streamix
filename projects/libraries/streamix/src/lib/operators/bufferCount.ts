import { createOperator } from "../abstractions";

export const bufferCount = (bufferSize: number = Infinity) =>
  createOperator("bufferCount", (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<any[]>> {
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
