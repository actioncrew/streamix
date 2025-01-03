import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const startWith = (value: any): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    const outputStream = createSubject<any>(); // Create the output stream
    let isStarted = false;

    // Emit the value at the start of the stream
    outputStream.next(value);

    // Subscribe to the original stream
    stream.subscribe({
      next: (emission) => {
        if (!isStarted) {
          isStarted = true; // Flag to mark the start after the first value is emitted
        }
        outputStream.next(emission);
      },
      complete: () => {
        outputStream.complete(); // Complete the stream when the original completes
      },
      error: (err) => {
        outputStream.error(err); // Forward errors if any
      }
    });

    return outputStream;
  };

    return createStreamOperator('startWith', operator);
};
