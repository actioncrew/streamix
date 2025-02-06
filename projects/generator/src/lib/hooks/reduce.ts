import { createSubject } from '..';
import { createEmission, createStreamOperator, Stream, StreamOperator } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any): StreamOperator => {
  let accumulatedValue = seed;
  let output = createSubject();

  const operator = (stream: Stream): Stream => {
    // Subscribe to the inputStream to start processing emissions
    const subscription = stream.subscribe({
      next: (value: any) => {
        // Accumulate the value using the provided accumulator function
        accumulatedValue = accumulator(accumulatedValue, value);
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
