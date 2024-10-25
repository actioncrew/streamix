import { createStream, Stream } from '../abstractions/stream';

// Function to create an EmptyStream
export const empty = <T = any>(): Stream<T> => {
  // Custom run function for the EmptyStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    // Set the auto-completion flag
    this.isAutoComplete = true;

    // Complete the stream immediately since it produces no emissions
    await this.complete();
  });

  stream.name = "EMPTY";
  // Create and return the EmptyStream using createStream
  return stream;
};

// Export a singleton instance of EmptyStream
export const EMPTY = empty();
