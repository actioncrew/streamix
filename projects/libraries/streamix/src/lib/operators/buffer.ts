import { createOperator } from "../abstractions";

export const buffer = (period: number) =>
  createOperator("buffer", (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<any[]>> {
        if (done) return { done: true, value: undefined };

        const buffer: any[] = [];
        const startTime = Date.now();

        while (true) {
          const { done: sourceDone, value } = await source.next();

          if (sourceDone) {
            done = true;
            // emit any remaining buffered values before completion
            return buffer.length > 0
              ? { done: false, value: buffer }
              : { done: true, value: undefined };
          }

          buffer.push(value);

          const elapsed = Date.now() - startTime;
          if (elapsed >= period) {
            // emit buffered chunk when period elapsed
            return { done: false, value: buffer };
          }
          // else continue collecting
        }
      }
    };
  });
