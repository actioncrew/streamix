import { createSubject } from '..';
import { createEmission, createStreamOperator, Emission, Stream, StreamOperator } from '../abstractions';

export const groupBy = <T = any>(keyFn: (value: T) => string | number): StreamOperator => {
  const operator = (input: Stream): Stream => {
    const output = createSubject<Map<string | number, T[]>>(); // The output stream to emit grouped results
    const partitions = new Map<string | number, T[]>(); // Store grouped partitions

    const groupByIterator = async function* (): AsyncGenerator<Emission<Map<string | number, T[]>>, void, unknown> {
      // Iterate over the input stream asynchronously
      try {
        for await (const emission of input) {
          const key = keyFn(emission.value); // Compute the partition key

          // Add the value to the corresponding partition
          if (!partitions.has(key)) {
            partitions.set(key, []);
          }
          partitions.get(key)!.push(emission.value); // Append value to the group
        }

        // Once the stream completes, emit all partitions as a single Map
        yield createEmission({ value: partitions });
      } catch (err) {
        // Handle any errors that occur during iteration
        output.error(err);
      }
    };

    // Handle the grouping logic using the async iterator
    (async () => {
      try {
        for await (const result of groupByIterator()) {
          output.next(result.value!); // Emit grouped partitions as the result
        }
        output.complete(); // Complete the output stream after processing
      } catch (err) {
        output.error(err); // Forward errors if any
      }
    })();

    return output; // Return the output stream
  };

  return createStreamOperator('groupBy', operator);
};
