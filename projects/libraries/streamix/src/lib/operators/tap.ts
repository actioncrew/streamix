import { createOperator } from '../abstractions';

export const tap = (tapFunction: (value: any) => void) =>
  createOperator('tap', (source) => {
    return {
      async next() {
        const result = await source.next();

        if (result.done) {
          return { done: true, value: undefined };
        }

        tapFunction(result.value); // Apply side effect
        return { done: false, value: result.value };
      }
    };
  });
