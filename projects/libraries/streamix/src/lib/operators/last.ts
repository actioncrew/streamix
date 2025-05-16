import { createOperator } from '../abstractions';

export const last = <T>(predicate?: (value: T) => boolean) =>
  createOperator('last', (source) => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        if (done) return { done: true, value: undefined as any };

        let lastMatch: T | undefined;
        let hasMatch = false;

        while (true) {
          const { value, done: iterDone } = await source.next();
          if (iterDone) break;

          if (!predicate || predicate(value)) {
            lastMatch = value;
            hasMatch = true;
          }
        }

        done = true;

        if (hasMatch) {
          return { value: lastMatch!, done: false };
        } else {
          throw new Error('No elements in sequence');
        }
      }
    };
  });
