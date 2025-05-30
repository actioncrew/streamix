import { createOperator } from "../abstractions";

export const toArray = () =>
  createOperator("toArray", (source) => {
    let collected: any[] | null = null;
    let emitted = false;

    return {
      async next(): Promise<IteratorResult<any[]>> {
        if (emitted) return { done: true, value: undefined };

        collected = [];
        while (true) {
          const { value, done } = await source.next();
          if (done) break;
          collected.push(value);
        }

        emitted = true;
        return { done: false, value: collected };
      }
    };
  });
