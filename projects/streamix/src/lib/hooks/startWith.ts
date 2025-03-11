import { createStreamOperator, Stream, Transformer } from '../abstractions';
import { createBehaviorSubject } from '../streams';

export const startWith = (value: any): Transformer => {
  const operator = (input: Stream): Stream => {
    const output = createBehaviorSubject<any>(value); // Create the output stream

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
        // Complete the output stream once the original stream completes
        output.complete();
      }
    })();

    return output;
  };

  return createStreamOperator('startWith', operator);
};
