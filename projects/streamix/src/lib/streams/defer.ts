import { createStream, Subscribable, Stream } from '../abstractions';

export function defer<T = any>(factory: () => Subscribable<T>): Stream<T> {
  let innerStream: Subscribable<T> | undefined;
  let handleEmissionFn: (event: { emission: { value: T }, source: Subscribable<T> }) => void;

  // Define the run method
  // Create and return the stream with the defined run function
  const stream = createStream<T>(async (): Promise<void> => {
    try {
      // Create a new inner stream from the factory
      innerStream = factory();

      // Set up emission handling for the inner stream
      handleEmissionFn = ({ emission }) => handleEmission(stream, emission.value);
      innerStream.onEmission.chain(stream, handleEmissionFn);

      // Start the inner stream
      innerStream.start();

      // Wait for the completion of the inner stream
      await innerStream.awaitCompletion();

    } catch (error) {
      await stream.onError.process({ error });
    } finally {
      await cleanupInnerStream();
    }
  });

  // Handle emissions from the inner stream
  const handleEmission = async (stream: Stream<T>, value: T): Promise<void> => {
    if (stream.shouldComplete()) {
      return;
    }

    await stream.onEmission.process({
      emission: { value },
      source: stream,
    });
  };

  // Clean up the inner stream when complete
  const cleanupInnerStream = async (): Promise<void> => {
    if (innerStream) {
      innerStream.onEmission.remove(stream, handleEmissionFn);
      await innerStream.complete();
      innerStream = undefined;
    }
  };

  // Override the complete method to ensure cleanup
  const originalComplete = stream.complete.bind(stream);
  stream.complete = async (): Promise<void> => {
    await cleanupInnerStream();
    return originalComplete();
  };

  return stream;
}
