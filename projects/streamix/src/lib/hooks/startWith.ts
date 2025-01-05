import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const startWith = (value: any): StreamOperator => {
  const operator = (input: Stream): Stream => {
    const output = createSubject<any>(); // Create the output stream
    let isStarted = false;

    // Subscribe to the original stream
    input.subscribe({
      next: (emission) => {
        if (!isStarted) {
          isStarted = true; // Flag to mark the start after the first value is emitted
          // Emit the value at the start of the stream
          output.next(value);
        }
        output.next(emission);
      },
      complete: () => {
        output.complete(); // Complete the stream when the original completes
      },
      error: (err) => {
        output.error(err); // Forward errors if any
      }
    });

    return output;
  };

    return createStreamOperator('startWith', operator);
};
