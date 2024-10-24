
import { createStream, Stream, Subscribable } from '../abstractions';

export function merge<T = any>(...sources: Subscribable[]): Stream<T> {
  // Create the custom run function for the MergeStream
  const run = async (stream: Stream<T>): Promise<void> => {
    // Start all sources
    sources.forEach(source => source.start());

    const emissionPromises = sources.map(source => {
      return new Promise<void>((resolve) => {
        const handleEmissionFn = async ({ emission }: { emission: { value: T }; source: Subscribable }) => {
          if (!stream.shouldComplete()) {
            await stream.onEmission.process({
              emission: { value: emission.value },
              source: stream,
            });
          }
        };

        // Chain emission handlers
        source.onEmission.chain(stream, handleEmissionFn);
        source.awaitCompletion().finally(() => {
          source.onEmission.remove(stream, handleEmissionFn); // Clean up emission handler
          resolve(); // Resolve when source completes
        });
      });
    });

    // Wait for all sources to complete
    await Promise.race([
      Promise.all(emissionPromises),
      stream.awaitCompletion(),
    ]);

    // Check if all sources are completed
    if (!stream.shouldComplete() && sources.every(source => source.shouldComplete())) {
      stream.isAutoComplete = true; // Set auto completion flag if not completed
    }
  };

  // Create the stream using createStream and the custom run function
  return createStream<T>(run);
}
