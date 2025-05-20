import { createOperator } from '../abstractions';

export const throwError = (message: string) =>
  createOperator('throwError', () => {
    let done = false;

    return {
      async next() {
        if (done) return { done: true, value: undefined };

        done = true;
        throw new Error(message); // Throw on first pull
      }
    };
  });
