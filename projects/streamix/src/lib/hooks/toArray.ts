import { createSubject } from '..';
import { createEmission, createStreamOperator, Stream, StreamOperator } from '../abstractions';

export const toArray = (): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    let accumulatedArray: any[] = []; // Array to store emission values
    const output = createSubject(); // Create an output stream

    const subscription = stream.subscribe({
      next: (emission) => {
        // Accumulate values from each emission
        accumulatedArray.push(emission.value);
      },
      complete: () => {
        // Emit the accumulated array as a single emission when the stream completes
        output.next(createEmission({ value: accumulatedArray }));
        output.complete();
        subscription.unsubscribe();
      },
    });

    return output;
  };

  return createStreamOperator('toArray', operator);
};

