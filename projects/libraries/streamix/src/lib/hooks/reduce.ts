import { createSubject } from '..';
import { createEmission, createStreamOperator, Stream, Transformer } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any): Transformer => {
  const operator = (input: Stream): Stream => {
    const output = createSubject();
    let accumulatedValue = seed;

    // Use async iterator to iterate over the input stream
    const reduceIterator = async function* () {
      for await (const emission of input) {
        // Apply the accumulator function on each emission
        accumulatedValue = accumulator(accumulatedValue, emission.value);
      }

      // Emit the final accumulated value after stream completion
      yield createEmission({ value: accumulatedValue });
    };

    // Handle the input stream and process values
    (async () => {
      try {
        // Iterate over the values emitted by the input stream
        for await (const result of reduceIterator()) {
          output.next(result); // Emit the accumulated value to the output stream
        }
        output.complete(); // Complete the output stream when the iteration is done
      } catch (err) {
        output.error(err); // Forward any errors to the output stream
      }
    })();

    return output; // Return the output stream
  };

  return createStreamOperator('reduce', operator);
};
