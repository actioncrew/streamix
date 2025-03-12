import { createSubject } from '..';
import { createTransformer, Stream, Transformer } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any): Transformer => {
  const operator = (input: Stream): Stream => {
    const output = createSubject();
    let accumulatedValue = seed;

    // Use async iterator to iterate over the input stream
    const reduceIterator = async function* () {
      for await (const value of input) {
        // Apply the accumulator function on each emission
        accumulatedValue = accumulator(accumulatedValue, value);
      }

      // Emit the final accumulated value after stream completion
      yield accumulatedValue;
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

  return createTransformer('reduce', operator);
};
