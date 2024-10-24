import { createStream, Stream, Subscribable } from '../abstractions';

export function defer<T = any>(factory: () => Subscribable): Stream<T> {
  // Create the custom run function for DeferStream
  const run = async (stream: Stream<T>): Promise<void> => {
    let innerStream: Subscribable | undefined;

    // Define the emission handling function
    const handleEmission = async ({ emission }: { emission: { value: T }; source: Subscribable }) => {
      if (!stream.shouldComplete()) {
        await stream.onEmission.process({
          emission: { value: emission.value },
          source: stream,
        });
      }
    };

    try {
      // Create a new stream from the factory function each time this stream is run
      innerStream = factory();

      // Chain the emission handler to the inner stream
      innerStream.onEmission.chain(stream, handleEmission);
      innerStream.start(); // Start the inner stream

      // Wait for completion or termination
      await innerStream.awaitCompletion();

    } catch (error) {
      await stream.onError.process({ error }); // Handle error
    } finally {
      await cleanupInnerStream(innerStream, stream, handleEmission); // Cleanup
    }
  };

  // Cleanup function for the inner stream
  const cleanupInnerStream = async (innerStream: Subscribable | undefined, stream: Stream<T>, handleEmission: (event: { emission: { value: T }; source: Subscribable }) => void): Promise<void> => {
    if (innerStream) {
      innerStream.onEmission.remove(stream, handleEmission); // Remove emission handler
      await innerStream.complete(); // Complete the inner stream
    }
  };

  // Create the stream using createStream and the custom run function
  return createStream<T>(run);
}
