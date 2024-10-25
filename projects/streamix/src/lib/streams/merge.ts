
import { createStream, Stream, Subscribable } from '../abstractions';

export function merge<T = any>(...sources: Subscribable[]): Stream<T> {
  // Create the custom run function for the MergeStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    // Start all sources
    sources.forEach(source => source.start());

    const emissionPromises = sources.map(source => {
      return new Promise<void>((resolve) => {
        const handleEmissionFn = async ({ emission }: { emission: { value: T }; source: Subscribable }) => {
          if (!this.shouldComplete()) {
            await this.onEmission.process({
              emission: { value: emission.value },
              source: this,
            });
          }
        };

        // Chain emission handlers
        source.onEmission.chain(this, handleEmissionFn);
        source.awaitCompletion().finally(() => {
          source.onEmission.remove(this, handleEmissionFn); // Clean up emission handler
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
  });

  stream.name = "merge";
  // Create the stream using createStream and the custom run function
  return stream;
}
