import { createStream, Stream } from '../abstractions';

// Function to create an EmptyStream
export const empty = <T = any>(): Stream<T> => {
  // Custom run function for the EmptyStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    // Set the auto-completion flag
    this.isAutoComplete = true;
  });

  stream.name = "EMPTY";
  return stream;
};

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
