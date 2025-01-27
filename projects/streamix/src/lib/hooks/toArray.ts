import { createSubject } from '../../lib';
import { createEmission, createStreamOperator, Emission, Stream, StreamOperator } from '../abstractions';

export const toArray = (): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    let accumulatedArray: any[] = []; // Array to store emission values
    const output = createSubject(); // Create an output stream

    const subscription = stream({
      next: async (emission: Emission) => {
        if (!emission.error) {
          // Accumulate values from each emission
          accumulatedArray.push(emission.value);
        } else {
          output.error(emission.error);
        }
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

