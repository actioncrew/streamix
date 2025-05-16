import { createOperator } from "../abstractions";

export const defaultIfEmpty = (defaultValue: any) =>
  createOperator("defaultIfEmpty", (source) => {
    let emitted = false;
    let done = false;

    return {
      async next(): Promise<IteratorResult<any>> {
        if (done) return { done: true, value: undefined };

        const result = await source.next();

        if (!result.done) {
          emitted = true;
          return result;
        }

        if (!emitted) {
          emitted = true;
          done = true;
          return { done: false, value: defaultValue };
        }

        done = true;
        return { done: true, value: undefined };
      }
    };
  });
