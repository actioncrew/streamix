import { createEmission, createStream, Stream, Subscribable, Subscription } from '../abstractions';
import { eventBus } from '../abstractions';

export function concat<T = any>(...sources: Subscribable[]): Stream<T> {
  let subscription: Subscription | undefined;

  // Create the custom run function for the ConcatStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    for (let currentSourceIndex = 0; currentSourceIndex < sources.length; currentSourceIndex++) {
      await runCurrentSource(this, sources[currentSourceIndex]);
    }
  });

  // Function to run the current source
  const runCurrentSource = async (stream: Stream<T>, currentSource: Subscribable): Promise<void> => {
    const handleEmissionFn = async (value: T) => {
      eventBus.enqueue({ target: stream, payload: { emission: createEmission({ value }), source: stream }, type: 'emission' });
    };

    try {
      subscription = currentSource.subscribe(value => handleEmissionFn(value)); // Start the current source
      currentSource.onComplete.once(() => subscription?.unsubscribe());
      await currentSource.awaitCompletion(); // Wait for the current source to complete
    } catch (error) {
      eventBus.enqueue({ target: stream, payload: { emission: createEmission({ error, failed: true }), source: stream }, type: 'emission' });
    }
  };

  stream.name = "concat";
  return stream;
}
