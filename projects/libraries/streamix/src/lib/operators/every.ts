import { createOperator } from '../abstractions';

export const every = <T = any>(
  predicate: (value: T, index: number) => boolean
) =>
  createOperator('every', (source) => {
    let index = 0;
    let allPassed = true;
    let finished = false;
    let finalResult: IteratorResult<boolean> = { value: true, done: false };

    async function next(): Promise<IteratorResult<boolean>> {
      if (finished) {
        return { value: finalResult.value, done: true };
      }

      while (true) {
        const result = await source.next();
        if (result.done) {
          finished = true;
          return { value: allPassed, done: true };
        }

        if (!predicate(result.value, index++)) {
          allPassed = false;
          finished = true;
          return { value: false, done: true };
        }
      }
    }

    return { next };
  });
