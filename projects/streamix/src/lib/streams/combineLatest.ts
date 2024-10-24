import { createStream, Stream, Subscribable } from '../abstractions';

export function combineLatest<T = any>(sources: Subscribable<T>[]): Stream<T[]> {
  // Buffer to hold the latest values from each source
  const values = sources.map(() => ({ hasValue: false, value: undefined as T | undefined }));

  // Custom run method for the CombineLatestStream
  const run = async (stream: Stream<T[]>): Promise<void> => {
    // Start all sources
    sources.forEach(source => source.start());

    try {
      await Promise.race([
        stream.awaitCompletion(), // Await completion of this stream
        Promise.all(sources.map(source => source.awaitCompletion())) // Await completion of all sources
      ]);
    } catch (error) {
      await stream.onError.process({ error });
    } finally {
      stream.complete();
    }
  };

  // Create the stream with the custom run function
  const stream = createStream<T[]>(run);

  // Helper method to handle emissions from sources
  const handleEmission = async (index: number, value: T): Promise<void> => {
    if (stream.shouldComplete()) {
      return;
    }

    values[index] = { hasValue: true, value }; // Store the emitted value

    // Emit combined values if all sources have emitted at least once
    if (values.every(v => v.hasValue)) {
      await stream.onEmission.process({
        emission: { value: values.map(({ value }) => value!) }, // Use non-null assertion to ensure type safety
        source: stream,
      });
    }
  };

  // Set up emission handlers for each source
  sources.forEach((source, index) => {
    const handle = (event: { emission: { value: T }, source: Subscribable }) =>
      handleEmission(index, event.emission.value);
    source.onEmission.chain(stream, handle);
  });

  // Override the complete method to clean up
  const originalComplete = stream.complete.bind(stream); // Preserve the original complete method
  stream.complete = async (): Promise<void> => {
    sources.forEach((source) => {
      source.onEmission.remove(stream, handleEmission);
      source.complete();
    });
    return originalComplete(); // Call the preserved complete method
  };

  return stream;
}
