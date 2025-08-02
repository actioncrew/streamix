import { createOperator } from "../abstractions";

export const toArray = <T = any>() =>
  createOperator<T, T[]>("toArray", (source) => {
    let collected: T[] | null = null;
    let emitted = false;

    return {
      async next(): Promise<IteratorResult<T[]>> {
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
