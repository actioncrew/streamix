import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const endWith = (value: any): StreamOperator => {
  const operator = (input: Stream): Stream => {
    const output = createSubject<any>(); // Create the output stream

    // Subscribe to the original stream
    const subscription = input.subscribe({
      next: (emission) => {
        output.next(emission); // Forward emissions from the original stream
      },
      complete: () => {
        output.next(value); // Emit the value at the end of the stream
        output.complete();   // Complete the stream after emitting the value
        subscription.unsubscribe();
      },
      error: (err) => {
        output.error(err); // Forward errors if any
      }
    });

    return output;
  };

  return createStreamOperator('endWith', operator);
};
