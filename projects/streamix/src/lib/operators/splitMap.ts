import { createOperator, Operator, Emission, eventBus } from '../abstractions';
import { createSubject, from } from '../streams';

export const splitMap = <T = any, R = T>(
  paths: { [key: string]: Array<Operator> }
): Operator => {
  const output = createSubject<R>(); // The final output stream
  let subscriptions: Array<any> = []; // Track subscriptions

  const handle = (emission: Emission) => {
    const partitionMap = emission.value as Map<string, any[]>; // Partitioned streams

    let remainingSubscriptions = 0;

    // Process each key in the partition map
    partitionMap.forEach((stream, key) => {
      const caseOperators = paths[key]; // Get the operators for the current key

      if (caseOperators) {
        // For each partition stream, subscribe and apply the operators
        const subscription = from(stream).pipe(...caseOperators).subscribe({
          next: (value) => {
            output.next(value); // Pass the value downstream
          },
          complete: () => {
            remainingSubscriptions--;
            if (remainingSubscriptions === 0) {
              output.complete(); // Complete the output stream when all subscriptions are done
            }
          },
        });

        // Increase the count of remaining subscriptions
        remainingSubscriptions++;
        subscriptions.push(subscription);
      } else {
        console.warn(`No handlers found for partition key: ${key}`);
      }
    });

    return emission;
  };

  // Create the operator and initialize its properties
  const operator = createOperator(handle) as any;
  operator.stream = output;
  operator.name = 'splitMap';

  return operator;
};
