import { createStream, Subscribable, Stream } from '../abstractions';
import { eventBus } from './bus';

export function defer<T = any>(factory: () => Subscribable<T>): Stream<T> {
  let innerStream: Subscribable<T> | undefined;
  let handleEmissionFn: (event: { emission: { value: T }, source: Subscribable<T> }) => void;

  // Define the run method
  // Create and return the stream with the defined run function
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    try {
      // Create a new inner stream from the factory
      innerStream = factory();

      // Set up emission handling for the inner stream
      handleEmissionFn = ({ emission }) => handleEmission(this, emission.value);
      innerStream.onEmission.chain(this, handleEmissionFn);

      // Start the inner stream
      innerStream.subscribe();

      innerStream.onComplete.once(async () => {
        this.isAutoComplete = true;
        await cleanupInnerStream();
      });

      await this.awaitCompletion();
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { emission: { error, failed: true }, source: this }, type: 'emission' });
    }
  });

  // Handle emissions from the inner stream
  const handleEmission = async (stream: Stream<T>, value: T): Promise<void> => {
    if (stream.shouldComplete()) {
      return;
    }

    eventBus.enqueue({ target: stream, payload: { emission: { value }, source: stream }, type: 'emission' });
  };

  // Clean up the inner stream when complete
  const cleanupInnerStream = async (): Promise<void> => {
    if (innerStream) {
      innerStream.isAutoComplete = true;
      innerStream.onEmission.remove(stream, handleEmissionFn);
      innerStream = undefined;
    }
  };

  // Override the complete method to ensure cleanup
  const originalComplete = stream.complete.bind(stream);
  stream.complete = async (): Promise<void> => {
    await cleanupInnerStream();
    return originalComplete();
  };

  stream.name = "defer";
  return stream;
}
