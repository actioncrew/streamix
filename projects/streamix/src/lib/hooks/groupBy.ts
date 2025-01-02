import { createSubject } from '../../lib';
import { hooks, Stream, StreamOperator } from '../abstractions';

export const groupBy = <T = any>(keyFn: (value: T) => string | number): StreamOperator => {
  return (stream: Stream) => {
    const outputStream = createSubject<Map<string | number, T[]>>(); // The output stream to emit grouped results
    const partitions = new Map<string | number, T[]>(); // Store grouped partitions

    const subscription = stream.subscribe({
      next: (value: T) => {
        const key = keyFn(value); // Compute the partition key

        // Add the value to the corresponding partition
        if (!partitions.has(key)) {
          partitions.set(key, []);
        }
        partitions.get(key)!.push(value); // Append value to the group
      },
      complete: () => {
        // Emit all partitions as a single Map when the stream completes
        outputStream.next(partitions);
        outputStream.complete();
      },
      error: (err) => {
        // Forward errors to the output stream
        outputStream.error(err);
      },
    });

    // Ensure the new stream cleans up the subscription when it completes
    outputStream[hooks].finalize.once(() => {
      subscription.unsubscribe();
    });

    return outputStream; // Return the output stream
  };
};
