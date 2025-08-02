import { CallbackReturnType, createOperator } from "../abstractions";

export const first = <T = any>(predicate?: (value: T) => CallbackReturnType<boolean>) =>
  createOperator<T, T>('first', (source) => {
    let found = false;
    let firstValue: T | undefined;
    let sourceDone = false;

    async function next(): Promise<IteratorResult<T>> {
      if (found) {
        return { value: undefined, done: true };
      }

      if (sourceDone) {
        throw new Error("No elements in sequence");
      }

      while (!found) {
        const result = await source.next();
        if (result.done) {
          sourceDone = true;
          throw new Error("No elements in sequence");
        }

        const value = result.value;
        if (!predicate || await predicate(value)) {
          found = true;
          firstValue = value;
          return { value: firstValue!, done: false };
        }
      }

      // Should not reach here
      return { value: undefined, done: true };
    }

    return { next };
  });
