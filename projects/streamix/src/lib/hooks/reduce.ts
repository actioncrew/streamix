import { createEmission, hooks, Stream, StreamOperator } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any): StreamOperator => {
  let accumulatedValue = seed;

  return (stream: Stream): Stream => {
    // Subscribe to the inputStream to start processing emissions
    const subscription = stream.subscribe({
      next: (value: any) => {
        // Accumulate the value using the provided accumulator function
        accumulatedValue = accumulator(accumulatedValue, value);
      },
      complete: () => {
        // Emit the accumulated value once the stream completes
        stream[hooks].onComplete.once(() => {
          return () => {
            const emission = createEmission({ value: accumulatedValue });
            // Emit the result as a final emission
            stream.next(emission);
          };
        });
      }
    });

    // Store the subscription and clean up on finalize
    stream[hooks].finalize.once(() => {
      subscription.unsubscribe();
    });

    return stream;
  };
};
