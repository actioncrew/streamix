import { createEmission, createStream, flags, internals, Stream, Subscription } from '../abstractions';

export function defer<T = any>(factory: () => Stream<T>): Stream<T> {
  let innerStream: Stream<T> | undefined;
  let subscription!: Subscription | undefined;
  // Define the run method
  // Create and return the stream with the defined run function
  const stream = createStream<T>('defer', async function(this: Stream<T>): Promise<void> {
    try {
      // Create a new inner stream from the factory
      innerStream = factory();

      // Start the inner stream
      subscription = innerStream.subscribe({
        next: value => handleEmission(this, value),
        complete: () => {
          if (!this[internals].shouldComplete()) {
            this[flags].isAutoComplete = true;
          }
        }
      });

      await this[internals].awaitCompletion();

      await cleanupInnerStream();

    } catch (error) {
      this.error(error);
    }
  });

  // Handle emissions from the inner stream
  const handleEmission = async (stream: Stream<T>, value: T): Promise<void> => {
    stream.next(createEmission({ value }));
  };

  // Clean up the inner stream when complete
  const cleanupInnerStream = async (): Promise<void> => {
    if (innerStream) {
      innerStream[flags].isAutoComplete = true;
      subscription?.unsubscribe();
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
