
import { createEmission, createStream, flags, hooks, internals, Stream, Subscribable } from '../abstractions';
import { eventBus } from '../abstractions';

export function merge<T = any>(...sources: Subscribable[]): Stream<T> {
  // Create the custom run function for the MergeStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {

    // Check if all sources are completed
    stream[hooks].onComplete.once(() => {
      if (!stream[internals].shouldComplete() && sources.every(source => source[internals].shouldComplete())) {
        stream[flags].isAutoComplete = true;
      }
    });

    const handleEmissionFn = async (value: T) => {
      if (!this[internals].shouldComplete()) {
        eventBus.enqueue({ target: this, payload: { emission: createEmission({ value }), source: this }, type: 'emission' });
      }
    };

    const emissionPromises = sources.map((source, index) => {
      return new Promise<void>(async (resolve) => {
        await source[internals].awaitCompletion();
        subscriptions[index].unsubscribe();
        resolve(); // Resolve when source completes
      });
    });

    // Start all sources
    const subscriptions = sources.map(source => source.subscribe(value => handleEmissionFn(value)));

    // Wait for all sources to complete
    await Promise.race([
      Promise.all(emissionPromises),
      stream[internals].awaitCompletion(),
    ]);
  });

  stream.name = "merge";
  // Create the stream using createStream and the custom run function
  return stream;
}
