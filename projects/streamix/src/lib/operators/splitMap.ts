import { Emission, Operator, Stream, StreamOperator } from '../abstractions';
import { createSubject, from } from '../streams';
import { createStreamOperator } from './../abstractions/operator';

export const splitMap = <T = any, R = T>(
  paths: { [key: string]: Array<Operator> }
): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject<R>(); // The output stream
    let subscriptions: Array<any> = []; // Track all subscriptions

    const subscription = input({
      next: async (emission: Emission) => {
        if (!emission.error) {
          let remainingSubscriptions = 0;
          let partitionMap: Map<string, any[]> = emission.value;
          // Process each key in the partition map
          partitionMap.forEach((streamData, key) => {
            const caseOperators = paths[key]; // Operators for the current partition

            if (caseOperators) {
              // Create a stream for the partition and apply the operators
              const partitionStream = from(streamData).pipe(...caseOperators);

              // Subscribe to the processed partition stream
              const partitionSubscription = partitionStream({
                next: async (emission: Emission) => {
                  if (!emission.error) {
                    output.next(emission.value);
                  } else {
                    output.error(emission.error);
                  }
                },
                complete: () => {
                  remainingSubscriptions--;
                  if (remainingSubscriptions === 0) {
                    output.complete(); // Complete when all partitions finish
                  }
                },
              });

              remainingSubscriptions++;
              subscriptions.push(partitionSubscription);
            } else {
              console.warn(`No handlers found for partition key: ${key}`);
            }
          });
        } else {
          output.error(emission.error);
        }
      },
      complete: () => {
        // Complete the output stream if the main stream completes with no partitions
        if (subscriptions.length === 0) {
          output.complete();
        }
      }
    });

    // Clean up all subscriptions when the output stream finalizes
    output.emitter.once('finalize', () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
      subscription.unsubscribe();
    });

    return output; // Return the resulting stream
  };

  return createStreamOperator('splitMap', operator);
};
