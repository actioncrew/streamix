import { createStream, Stream, Subscribable } from '../abstractions';

export function concat<T = any>(...sources: Subscribable[]): Stream<T> {
  // Create the custom run function for the ConcatStream
  const run = async (stream: Stream<T>): Promise<void> => {
    for (let currentSourceIndex = 0; currentSourceIndex < sources.length; currentSourceIndex++) {
      if (stream.shouldComplete()) {
        break; // Exit if completion is requested
      }
      await runCurrentSource(stream, sources[currentSourceIndex]);
    }

    if (!stream.shouldComplete()) {
      stream.isAutoComplete = true; // Set auto completion flag if not completed
    }
  };

  // Function to run the current source
  const runCurrentSource = async (stream: Stream<T>, currentSource: Subscribable): Promise<void> => {
    const handleEmissionFn = async ({ emission }: { emission: { value: T }; source: Subscribable }) => {
      if (!stream.shouldComplete()) {
        await stream.onEmission.process({
          emission: { value: emission.value },
          source: stream,
        });
      }
    };

    try {
      currentSource.onEmission.chain(stream, handleEmissionFn); // Chain emissions
      currentSource.start(); // Start the current source
      await currentSource.awaitCompletion(); // Wait for the current source to complete
    } catch (error) {
      await stream.onError.process({ error }); // Propagate error if occurs
    } finally {
      currentSource.onEmission.remove(stream, handleEmissionFn); // Clean up emission handler
      await currentSource.complete(); // Complete the current source
    }
  };

  // Create the stream using createStream and the custom run function
  return createStream<T>(run);
}
