import { createStream, Stream, Subscribable, Subscription } from '../abstractions';

export function concat<T = any>(...sources: Subscribable[]): Stream<T> {
  let subscription: Subscription | undefined;

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
    const handleEmissionFn = async (value: T) => {
      if (!stream.shouldComplete()) {
        await stream.onEmission.parallel({
          emission: { value },
          source: stream,
        });
      }
    };

    try {
      subscription = currentSource.subscribe(value => handleEmissionFn(value)); // Start the current source
      await currentSource.awaitCompletion(); // Wait for the current source to complete
    } catch (error) {
      await stream.onEmission.parallel({ emission: { error, isFailed: true }, source: stream }); // Propagate error if occurs
    } finally {
      subscription?.unsubscribe();
      await currentSource.complete(); // Complete the current source
    }
  };

  stream.name = "concat";
  return stream;
}
