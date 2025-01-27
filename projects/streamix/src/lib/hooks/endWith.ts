import { createStreamOperator, Emission, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const endWith = (value: any): StreamOperator => {
  const operator = (input: Stream): Stream => {
    const output = createSubject<any>(); // Create the output stream

    // Subscribe to the original stream
    input({
      next: async (emission: Emission) => {
        if (!emission.error) {
          output.next(emission.value); // Pass the value through to the output stream
        } else {
          output.error(emission.error);  // Pass the error through to the output stream
        }
      },
      complete: () => {
        output.next(value); // Emit the value at the end of the stream
        output.complete();   // Complete the stream after emitting the value
      }
    });

    return output;
  };

  return createStreamOperator('endWith', operator);
};
