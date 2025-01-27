import { createSubject } from '../../lib';
import { createEmission, createStreamOperator, Emission, Stream, StreamOperator } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any): StreamOperator => {
  let accumulatedValue = seed;
  let output = createSubject();

  const operator = (stream: Stream): Stream => {
    // Subscribe to the inputStream to start processing emissions
    const subscription = stream({
      next: async (emission: Emission) => {
        if (!emission.error) {
          // Accumulate the value using the provided accumulator function
          accumulatedValue = accumulator(accumulatedValue, emission.value);
        } else {
          output.error(emission.error);
        }
      },
      complete: () => {
        // Emit the accumulated value once the stream completes
        const emission = createEmission({ value: accumulatedValue });
        output.next(emission);
        output.complete();
        subscription.unsubscribe();
      }
    });

    return output;
  };

    return createStreamOperator('reduce', operator);
};
