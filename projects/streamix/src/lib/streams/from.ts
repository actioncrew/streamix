import { Emission } from '../abstractions';
import { createStream, Stream } from '../abstractions/stream';

// Function to create a FromStream
export const from = <T = any>(input: T[] | IterableIterator<T>): Stream<T> => {
  // Create an iterator based on the input
  const iterator: IterableIterator<T> = Array.isArray(input)
    ? input[Symbol.iterator]() // Convert array to iterator
    : (input as IterableIterator<T>);

  // Custom run function for the FromStream
  const run = async (stream: Stream<T>): Promise<void> => {
    let done = false;

    while (!done && !stream.shouldComplete()) {
      const { value, done: iterationDone } = iterator.next();
      if (iterationDone) {
        done = true;
        if (!stream.shouldComplete()) {
          stream.isAutoComplete = true; // Mark stream as auto-completing
        }
      } else {
        const emission: Emission = { value };
        await stream.onEmission.process({ emission, source: stream });

        if (emission.isFailed) {
          throw emission.error;
        }
      }
    }
  };

  // Create and return the FromStream using createStream
  return createStream<T>(run);
};
