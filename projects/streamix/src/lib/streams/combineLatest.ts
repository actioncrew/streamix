import { createStream, Stream, Subscribable } from '../abstractions';

export function combineLatest<T = any>(sources: Subscribable<T>[]): Stream<T> {
  const values = sources.map(() => ({ hasValue: false, value: undefined as T | undefined }));
  const handlers: Array<(event: { emission: { value: T }, source: Subscribable }) => void> = [];

  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    sources.forEach(source => source.start());

    try {
      await Promise.race([
        this.awaitCompletion(),
        Promise.all(sources.map(source => source.awaitCompletion()))
      ]);
    } catch (error) {
      await this.onError.process({ error });
    } finally {
      this.complete();
    }
  });

  sources.forEach((source, index) => {
    handlers[index] = async (event) => {
      if (stream.shouldComplete()) return;

      values[index] = { hasValue: true, value: event.emission.value };

      if (values.every(v => v.hasValue)) {
        return stream.onEmission.process({
          emission: { value: values.map(v => v.value!) },
          source: stream,
        });
      }
    };

    source.onEmission.chain(stream, handlers[index]);
  });

  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function(): Promise<void> {
    sources.forEach((source, index) => {
      source.onEmission.remove(stream, handlers[index]);
      source.complete();
    });
    return originalComplete();
  };

  return stream;
}
