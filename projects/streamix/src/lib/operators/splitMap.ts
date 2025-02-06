import { Operator, Stream, StreamOperator, Subscription } from '../abstractions';
import { createStreamOperator } from '../abstractions/operator';
import { createSubject, from } from '../streams';

export const splitMap = (
  paths: { [key: string]: Array<Operator> }
): StreamOperator => {
  const operator = (input: Stream): Stream => {
    const output = createSubject(); // The output stream
    let activeSubscriptions: Subscription[] = [];
    let partitionQueue: Array<{ key: string; values: any[] }> = []; // Queue to track partitions
    let isProcessing = false; // Flag to track if we're currently processing a partition
    let isOuterComplete = false; // Flag to track if the outer stream has completed

    const processNextPartition = () => {
      if (partitionQueue.length === 0 || isProcessing) {
        // No partitions to process or already processing
        checkComplete();
        return;
      }

      isProcessing = true;
      const { key, values } = partitionQueue.shift()!; // Dequeue the next partition
      const caseOperators = paths[key]; // Operators for the current partition

      if (caseOperators) {
        // Create a stream for the partition and apply the operators
        const partitionStream = from(values).pipe(...caseOperators);

        // Subscribe to the processed partition stream
        const partitionSubscription = partitionStream.subscribe({
          next: (value) => output.next(value),
          error: (err) => {
            output.error(err);
            activeSubscriptions = activeSubscriptions.filter(
              (sub) => sub !== partitionSubscription
            );
            isProcessing = false;
            processNextPartition(); // Process the next partition after error
          },
          complete: () => {
            activeSubscriptions = activeSubscriptions.filter(
              (sub) => sub !== partitionSubscription
            );
            isProcessing = false;
            processNextPartition(); // Process the next partition after completion
          },
        });

        activeSubscriptions.push(partitionSubscription);
      } else {
        console.warn(`No handlers found for partition key: ${key}`);
        isProcessing = false;
        processNextPartition(); // Process the next partition if no handlers
      }
    };

    const checkComplete = () => {
      if (isOuterComplete && partitionQueue.length === 0 && activeSubscriptions.length === 0 && !isProcessing) {
        output.complete();
      }
    };

    input.subscribe({
      next: (partitionMap: Map<string, any[]>) => {
        // Enqueue partitions in the order they arrive
        partitionMap.forEach((values, key) => {
          partitionQueue.push({ key, values });
        });

        // Start processing partitions if not already processing
        if (!isProcessing) {
          processNextPartition();
        }
      },
      complete: () => {
        isOuterComplete = true;
        checkComplete();
      },
      error: (err) => {
        output.error(err);
      },
    });

    return output; // Return the resulting stream
  };

  return createStreamOperator('splitMap', operator);
};
