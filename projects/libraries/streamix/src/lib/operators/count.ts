import { createOperator } from "../abstractions";

export const count() => 
  createOperator('count', (sourceIter) => {
    let count = 0;
    let done = false;

    return {
      async next() {
        if (done) {
          return { done: true };
        }

        const result = await sourceIter.next();

        if (result.done) {
          done = true;
          return { value: count, done: true };
        }

        count++;
        return this.next(); // Continue pulling from the source until done
      }
    };
  });
