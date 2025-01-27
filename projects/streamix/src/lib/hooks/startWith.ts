import { createStreamOperator, Emission, Stream, StreamOperator } from '../abstractions';
import { createBehaviorSubject } from '../streams';

export const startWith = (value: any): StreamOperator => {
  const operator = (input: Stream): Stream => {
    const output = createBehaviorSubject<any>(value); // Create the output stream

    // Subscribe to the original stream
    input({
      next: async (emission: Emission) => {
        if (!emission.error) {
          output.next(emission.value);
        } else {
          output.error(emission.error); // Forward errors if any
        }
      },
      complete: () => {
        output.complete(); // Complete the stream when the original completes
      }
    });

    return output;
  };

    return createStreamOperator('startWith', operator);
};
