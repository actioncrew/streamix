import { createEmission, createStream, internals, Stream, Subscription } from '../abstractions';
// Ensure catchAny is imported from the correct location

export function combineLatest<T = any>(sources: Stream<T>[]): Stream<T[]> {
  const values = sources.map(() => ({ hasValue: false, value: undefined as T | undefined })); // Track the latest value from each source
  const subscriptions: Subscription[] = []; // List of source subscriptions

  const stream = createStream<T[]>(async function (this: Stream<T[]>): Promise<void> {
    sources.forEach((source, index) => {
      const subscription = source.subscribe({
        next: (value: T) => {
          if (stream[internals].shouldComplete()) return;

          // Store the latest value from the source
          values[index] = { hasValue: true, value };

          // Emit combined values only when all sources have emitted at least once
          if (values.every((v) => v.hasValue)) {
            this.next(createEmission({ value: values.map((v) => v.value!) }));
          }
        },
        complete: () => {
          // Complete the main stream only after all sources are complete
          const allSourcesCompleted = subscriptions.every((sub) => sub.completed);
          if (allSourcesCompleted) {
            stream.complete();
          }
        },
        error: (err: any) => {
          // Propagate errors from the source streams
          this.error(err);
        },
      });

      subscriptions.push(subscription); // Store the subscription for cleanup
    });

    await this[internals].awaitCompletion();
  });

  // Cleanup subscriptions when the main stream terminates
  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function (): Promise<void> {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    return originalComplete();
  };

  stream.name = 'combineLatest';
  return stream;
}
