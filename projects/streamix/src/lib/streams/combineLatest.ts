import { createStream, Stream, Subscribable } from '../abstractions';
import { catchAny } from '../utils'; // Ensure catchAny is imported from the correct location
import { eventBus } from '../abstractions';

export function combineLatest<T = any>(sources: Subscribable<T>[]): Stream<T> {
  const values = sources.map(() => ({ hasValue: false, value: undefined as T | undefined }));
  const handlers: Array<(value: T) => void> = [];

  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {

    this.onComplete.once(() => {
      this.isAutoComplete = true;
    });

    const [error] = await catchAny(Promise.race([
      this.awaitCompletion(),
      Promise.all(sources.map(source => source.awaitCompletion()))
    ]));

    if (error) {
      eventBus.enqueue({ target: this, payload: {emission: { error, failed: true }, source: this }, type: 'emission' });
    }
  });

  sources.forEach((source, index) => {
    handlers[index] = async (value: T) => {
      if (stream.shouldComplete()) return;

      values[index] = { hasValue: true, value };

      if (values.every(v => v.hasValue)) {
        eventBus.enqueue({
          target: stream,
          payload: { emission: { value: values.map(v => v.value!) },
          source: stream },
          type: 'emission'
        });
      }
    };
  });

  const subscriptions = sources.map((source, index) => source.subscribe((value) => handlers[index](value)));

  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function(): Promise<void> {
    sources.forEach((source, index) => {
      source.complete();
      subscriptions[index].unsubscribe();
    });
    return originalComplete();
  };

  stream.name = "combineLatest";
  return stream;
}
