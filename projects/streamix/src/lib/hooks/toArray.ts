import { createSubject } from '..';
import { createStreamOperator, Stream, StreamOperator } from '../abstractions';

export const toArray = (): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    let accumulatedArray: any[] = []; // Array to store emission values
    const output = createSubject(); // Create an output stream

    const subscription = stream.subscribe({
      next: (value) => {
        // Accumulate values from each emission
        accumulatedArray.push(value);
      },
      complete: () => {
        // Emit the accumulated array as a single emission when the stream completes
        output.next(accumulatedArray);
        output.complete();
        subscription.unsubscribe();
      },
    });

    return output;
  };

  return createStreamOperator('toArray', operator);
};

