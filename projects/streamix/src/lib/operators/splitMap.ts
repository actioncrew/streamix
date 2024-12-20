import { createOperator, Operator, Subscribable, Emission } from '../abstractions';
import { createSubject } from '../streams';

export const splitMap = <T = any, R = T>(
  paths: { [key: string]: Array<Operator> }
): Operator => {
  const output = createSubject<R>(); // The final output stream
  let emissionQueue: Emission[] = []; // Queue to handle emissions

  const handle = (emission: Emission) => {
    const partitionMap = emission.value as Map<string, Subscribable>; // Partitioned streams

    // Process each key in the partition map
    partitionMap.forEach((stream, key) => {
      const caseOperators = paths[key]; // Get the operators for the current key

      if (caseOperators) {
        // Apply the operators for the current partition
        caseOperators.forEach((operator) => {
          const clonedOperator = operator.clone();
          output.pipe(clonedOperator); // Connect the operator to the output stream
        });

        // Subscribe to the partition stream and handle emissions
        stream.subscribe({
          next: (value) => {
            emissionQueue.push(emission); // Add emission to queue
            output.next(value); // Pass the value downstream
          },
          complete: () => {
            // Optionally handle the completion of the partition
            emission.finalize(); // Ensure emission finalization
          },
          error: (err) => {
            // Handle any errors that occur in the partition stream
            console.error(`Error in partition ${key}:`, err);
          },
        });
      } else {
        // If no operators exist for this partition key, log a warning
        console.warn(`No handlers found for partition key: ${key}`);
      }
    });

    return emission;
  };

  // Create the operator and initialize its properties
  const operator = createOperator(handle);
  operator.name = 'splitMap';

  return operator;
};
