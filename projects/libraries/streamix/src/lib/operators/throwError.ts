import { createOperator } from '../abstractions';

export const throwError = <T = any>(message: string) =>
  createOperator<T, never>('throwError', () => {
    let done = false;

    return {
      async next(): Promise<IteratorResult<never>> {
        if (done) return { done: true as const, value: undefined as never };

        done = true;
        throw new Error(message);
      }
    };
  });
