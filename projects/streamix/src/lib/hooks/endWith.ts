import { createStreamOperator, Stream, Transformer } from '../abstractions';
import { createSubject } from '../streams';

export const endWith = (value: any): Transformer => {
  const operator = (input: Stream): Stream => {
    const output = createSubject<any>(); // Create the output stream

    // Subscribe to the original stream
    (async () => {
      try {
        // Iterate over the input stream asynchronously
        for await (const emission of input) {
          output.next(emission.value); // Forward emissions from the original stream
        }
      } catch (err) {
        output.error(err);
      } finally {
        // Emit the value at the end of the stream and complete the stream
        output.next(value);
        output.complete();
      }
    })();

    return output;
  };

  return createStreamOperator('endWith', operator);
};
