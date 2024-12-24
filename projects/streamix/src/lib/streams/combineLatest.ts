import { createEmission, createStream, internals, Stream, Subscribable, Subscription } from '../abstractions';
import { catchAny } from '../utils'; // Ensure catchAny is imported from the correct location
import { eventBus } from '../abstractions';

export function combineLatest<T = any>(sources: Subscribable<T>[]): Stream<T[]> {
  const values = sources.map(() => ({ hasValue: false, value: undefined as T | undefined })); // Track the latest value from each source
  const subscriptions: Subscription[] = []; // List of source subscriptions

  const stream = createStream<T[]>(async function (this: Stream<T[]>): Promise<void> {
    const [error] = await catchAny(
      Promise.race([
        this[internals].awaitCompletion(),
        Promise.all(sources.map((source) => source[internals].awaitCompletion())),
      ])
    );

    if (error) {
      eventBus.enqueue({ target: this, payload: { error }, type: 'error' });
      return;
    }

    await this[internals].awaitCompletion();
  });

  // Override the `run` method to start the source streams only after the main stream starts
  const originalRun = stream.run;
  stream.run = async function (): Promise<void> {
    sources.forEach((source, index) => {
      const subscription = source.subscribe({
        next: (value: T) => {
          if (stream[internals].shouldComplete()) return;

          // Store the latest value from the source
          values[index] = { hasValue: true, value };

          // Emit combined values only when all sources have emitted at least once
          if (values.every((v) => v.hasValue)) {
            eventBus.enqueue({
              target: stream,
              payload: {
                emission: createEmission({ value: values.map((v) => v.value!) }),
                source: stream,
              },
              type: 'emission',
            });
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
          eventBus.enqueue({ target: stream, payload: { error: err }, type: 'error' });
        },
      });

      subscriptions.push(subscription); // Store the subscription for cleanup
    });

    await originalRun.call(stream); // Start the main stream
  };

  // Cleanup subscriptions when the main stream terminates
  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function (): Promise<void> {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    return originalComplete();
  };

  stream.name = 'combineLatest';
  return stream;
}
