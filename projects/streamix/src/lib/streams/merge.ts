import { createEmission, createStream, flags, hooks, internals, Stream, Subscribable, Subscription } from '../abstractions';
import { eventBus } from '../abstractions';

export function merge<T = any>(...sources: Subscribable[]): Stream<T> {
  const subscriptions: Subscription[] = [];

  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    const sourcePromises = sources.map((source) => {
      return new Promise<void>((resolve, reject) => {
        const subscription = source.subscribe({
          next: (value) => {
            const emission = createEmission({ value });
            eventBus.enqueue({ target: this, payload: { emission, source: this }, type: 'emission' });
          },
          error: (err) => {
            eventBus.enqueue({ target: this, payload: { error: err }, type: 'error' });
            reject(err); // Reject the promise on error
            finalize(); // Stop all processing on error
          },
          complete: () => {
            subscription.unsubscribe();
            resolve(); // Resolve the promise when the source completes
          },
        });

        subscriptions.push(subscription);
      });
    });

    try {
      // Wait for all sources to complete or for the stream to stop
      await Promise.race([ Promise.all(sourcePromises), this[internals].awaitCompletion() ]);
    } finally {
      finalize(); // Ensure cleanup
    }
  });

  const finalize = () => {
    subscriptions.forEach((sub) => sub.unsubscribe());
    subscriptions.length = 0;
  };

  stream.name = "merge";
  return stream;
}
