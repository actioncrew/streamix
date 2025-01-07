import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createBehaviorSubject } from '../streams';

export const startWith = (value: any): StreamOperator => {
  const operator = (input: Stream): Stream => {
    const output = createBehaviorSubject<any>(value); // Create the output stream

    // Subscribe to the original stream
    input.subscribe({
      next: (emission) => {
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
