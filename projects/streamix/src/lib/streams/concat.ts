import { createStream, Stream, Subscribable } from '../abstractions';

export function concat<T = any>(...sources: Subscribable[]): Stream<T> {
  // Create the custom run function for the ConcatStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    for (let currentSourceIndex = 0; currentSourceIndex < sources.length; currentSourceIndex++) {
      if (this.shouldComplete()) {
        break; // Exit if completion is requested
      }
      await runCurrentSource(this, sources[currentSourceIndex]);
    }

    if (!this.shouldComplete()) {
      this.isAutoComplete = true; // Set auto completion flag if not completed
    }
  });

  // Function to run the current source
  const runCurrentSource = async (stream: Stream<T>, currentSource: Subscribable): Promise<void> => {
    const handleEmissionFn = async ({ emission }: { emission: { value: T }; source: Subscribable }) => {
      if (!stream.shouldComplete()) {
        await stream.onEmission.parallel({
          emission: { value: emission.value },
          source: stream,
        });
      }
    };

    try {
      currentSource.onEmission.chain(stream, handleEmissionFn); // Chain emissions
      currentSource.subscribe(); // Start the current source
      await currentSource.awaitCompletion(); // Wait for the current source to complete
    } catch (error) {
      await stream.onError.parallel({ error }); // Propagate error if occurs
    } finally {
      currentSource.onEmission.remove(stream, handleEmissionFn); // Clean up emission handler
      await currentSource.complete(); // Complete the current source
    }
  };

  stream.name = "concat";
  // Create the stream using createStream and the custom run function
  return stream;
}
