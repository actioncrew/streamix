import { createOperator } from "../abstractions";

export const take = <T>(count: number) =>
  createOperator("take", (source) => {
    let emitted = 0;
    let done = false;

    return {
      async next() {
        if (done) return { done: true, value: undefined };

        if (emitted >= count) {
          done = true;
          return { done: true, value: undefined };
        }

        const result = await source.next();

        if (result.done) {
          done = true;
          return { done: true, value: undefined };
        }

        emitted++;
        return { done: false, value: result.value };
      }
    };
  });
