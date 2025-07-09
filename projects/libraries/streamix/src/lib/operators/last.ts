import { createOperator } from "../abstractions";
import { CallbackReturnType } from './../abstractions/receiver';

export const last = <T = any>(predicate?: (value: T) => CallbackReturnType<boolean>) =>
  createOperator('last', (source) => {
    let finished = false;
    let lastValue: T | undefined;
    let hasMatch = false;

    async function next(): Promise<IteratorResult<T>> {
      if (finished) {
        return { value: lastValue, done: true }; // Return the cached value
      }

      try {
        let result = await source.next();
        while (!result.done) {
          const value = result.value;
          if (!predicate || await predicate(value)) {
            lastValue = value;
            hasMatch = true;
          }
          result = await source.next(); // Keep iterating
        }

        finished = true; // Source is done

        if (hasMatch) {
          return { value: lastValue!, done: false };
        } else {
          throw new Error("No elements in sequence");
        }
      } catch (err) {
        finished = true;
        throw err;
      }
    }

    return { next };
  });
