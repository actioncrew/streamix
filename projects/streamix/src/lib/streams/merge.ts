
import { createEmission, createStream, Stream, Subscribable } from '../abstractions';
import { eventBus } from '../abstractions';

export function merge<T = any>(...sources: Subscribable[]): Stream<T> {
  // Create the custom run function for the MergeStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {

    // Check if all sources are completed
    stream.onComplete.once(() => {
      if (!stream.shouldComplete() && sources.every(source => source.shouldComplete())) {
        stream.isAutoComplete = true;
      }
    });

    const handleEmissionFn = async (value: T) => {
      if (!this.shouldComplete()) {
        eventBus.enqueue({ target: this, payload: { emission: createEmission({ value }), source: this }, type: 'emission' });
      }
    };

    const emissionPromises = sources.map((source, index) => {
      return new Promise<void>(async (resolve) => {
        await source.awaitCompletion();
        subscriptions[index].unsubscribe();
        resolve(); // Resolve when source completes
      });
    });

    // Start all sources
    const subscriptions = sources.map(source => source.subscribe(value => handleEmissionFn(value)));

    // Wait for all sources to complete
    await Promise.race([
      Promise.all(emissionPromises),
      stream.awaitCompletion(),
    ]);
  });

  stream.name = "merge";
  // Create the stream using createStream and the custom run function
  return stream;
}
