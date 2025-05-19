import { createOperator } from '../abstractions';

export const skip = (count: number) =>
  createOperator('skip', (source) => {
    let counter = count;

    return {
      async next(): Promise<IteratorResult<any>> {
        while (true) {
          const { done, value } = await source.next();
          if (done) {
            return { done: true, value: undefined };
          }

          if (counter > 0) {
            counter--;
            continue; // Skip this value
          }

          return { done: false, value };
        }
      },
    };
  });
