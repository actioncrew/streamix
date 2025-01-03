import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const endWith = (value: any): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    const outputStream = createSubject<any>(); // Create the output stream

    // Subscribe to the original stream
    stream.subscribe({
      next: (emission) => {
        outputStream.next(emission); // Forward emissions from the original stream
      },
      complete: () => {
        outputStream.next(value); // Emit the value at the end of the stream
        outputStream.complete();   // Complete the stream after emitting the value
      },
      error: (err) => {
        outputStream.error(err); // Forward errors if any
      }
    });

    return outputStream;
  };

  return createStreamOperator('endWith', operator);
};
