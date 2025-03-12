import { createSubject } from '..';
import { createTransformer, Stream, Transformer } from '../abstractions';

export const toArray = (): Transformer => {
  const operator = (input: Stream): Stream => {
    const output = createSubject<any>(); // Create an output stream
    let accumulatedArray: any[] = [];  // Array to accumulate emission values

    const toArrayIterator = async function* () {
      for await (const value of input) {
        // Collect each value emitted by the input stream into the array
        accumulatedArray.push(value);
      }
      // Once the stream completes, emit the accumulated array
      yield accumulatedArray;
    };

    // Handle the stream using the iterator
    (async () => {
      try {
        // Iterate over all emissions from the input stream
        for await (const result of toArrayIterator()) {
          output.next(result);  // Emit the accumulated array to the output stream
        }
        output.complete();  // Complete the output stream once all values are processed
      } catch (err) {
        output.error(err);  // Forward any errors from the stream
      }
    })();

    return output;  // Return the output stream
  };

  return createTransformer('toArray', operator);
};
