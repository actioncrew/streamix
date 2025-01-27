import { createSubject } from '../../lib';
import { createStreamOperator, Emission, Stream, StreamOperator } from '../abstractions';

export const groupBy = <T = any>(keyFn: (value: T) => string | number): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject<Map<string | number, T[]>>(); // The output stream to emit grouped results
    const partitions = new Map<string | number, T[]>(); // Store grouped partitions

    const subscription = input({
      next: async (emission: Emission) => {
        if (!emission.error) {
          const key = keyFn(emission.value); // Compute the partition key

          // Add the value to the corresponding partition
          if (!partitions.has(key)) {
            partitions.set(key, []);
          }
          partitions.get(key)!.push(emission.value); // Append value to the group
        } else {
          output.error(emission.error);
        }
      },
      complete: () => {
        // Emit all partitions as a single Map when the stream completes
        output.next(partitions);
        output.complete();
      }
    });

    // Ensure the new stream cleans up the subscription when it completes
    output.emitter.once('finalize', () => {
      subscription.unsubscribe();
    });

    return output; // Return the output stream
  };

  return createStreamOperator('groupBy', operator);
};
