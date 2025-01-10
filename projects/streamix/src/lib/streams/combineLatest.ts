import { createEmission, createStream, internals, Stream, Subscription } from '../abstractions';

export function combineLatest<T = any>(sources: Stream<T>[]): Stream<T[]> {
  const values = sources.map(() => ({ hasValue: false, value: undefined as T | undefined })); // Track the latest value from each source
  const subscriptions: Subscription[] = []; // List of source subscriptions
  let completedSources = 0; // Track how many sources have completed

  const stream = createStream<T[]>('combineLatest', async function (this: Stream<T[]>): Promise<void> {
    sources.forEach((source, index) => {
      const subscription = source({
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
          completedSources++;

          // Complete the main stream only after all sources are complete
          if (completedSources === sources.length) {
            // Emit the final combined value before completing
            if (values.every((v) => v.hasValue)) {
              this.next(createEmission({ value: values.map((v) => v.value!) }));
            }
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

    await stream[internals].awaitCompletion();
  });

  // Cleanup subscriptions when the main stream terminates
  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function (): Promise<void> {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    return originalComplete();
  };

  return stream;
}
