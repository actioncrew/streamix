import { createStream, Stream } from '../abstractions/stream';

// Function to create an EmptyStream
export const empty = <T = any>(): Stream<T> => {
  // Custom run function for the EmptyStream
  const run = async (stream: Stream<T>): Promise<void> => {
    // Set the auto-completion flag
    stream.isAutoComplete = true;

    // Complete the stream immediately since it produces no emissions
    await stream.complete();
  };

  // Create and return the EmptyStream using createStream
  return createStream<T>(run);
};

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
