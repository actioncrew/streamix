import { hooks, Operator, Stream, StreamOperator } from '../abstractions';
import { createSubject, from } from '../streams';

export const splitMap = <T = any, R = T>(
  paths: { [key: string]: Array<Operator> }
): StreamOperator => {
  return (stream: Stream) => {
    const outputStream = createSubject<R>(); // The output stream
    let subscriptions: Array<any> = []; // Track all subscriptions

    const subscription = stream.subscribe({
      next: (partitionMap: Map<string, any[]>) => {
        let remainingSubscriptions = 0;

        // Process each key in the partition map
        partitionMap.forEach((streamData, key) => {
          const caseOperators = paths[key]; // Operators for the current partition

          if (caseOperators) {
            // Create a stream for the partition and apply the operators
            const partitionStream = from(streamData).pipe(...caseOperators);

            // Subscribe to the processed partition stream
            const partitionSubscription = partitionStream.subscribe({
              next: (value) => outputStream.next(value),
              complete: () => {
                remainingSubscriptions--;
                if (remainingSubscriptions === 0) {
                  outputStream.complete(); // Complete when all partitions finish
                }
              },
            });

            remainingSubscriptions++;
            subscriptions.push(partitionSubscription);
          } else {
            console.warn(`No handlers found for partition key: ${key}`);
          }
        });
      },
      complete: () => {
        // Complete the output stream if the main stream completes with no partitions
        if (subscriptions.length === 0) {
          outputStream.complete();
        }
      },
      error: (err) => {
        // Propagate errors to the output stream
        outputStream.error(err);
      },
    });

    // Clean up all subscriptions when the output stream finalizes
    outputStream[hooks].finalize.once(() => {
      subscriptions.forEach((sub) => sub.unsubscribe());
      subscription.unsubscribe();
    });

    return outputStream; // Return the resulting stream
  };
};
