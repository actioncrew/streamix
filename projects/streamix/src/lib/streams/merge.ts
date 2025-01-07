import { createEmission, createStream, internals, Stream, Subscription } from '../abstractions';

export function merge<T = any>(...sources: Stream[]): Stream<T> {
  const subscriptions: Subscription[] = [];

  const stream = createStream<T>('merge', async function(this: Stream<T>): Promise<void> {
    const sourcePromises = sources.map((source) => {
      return new Promise<void>((resolve, reject) => {
        const subscription = source.subscribe({
          next: (value) => {
            const emission = createEmission({ value });
            this.next(emission);
          },
          error: (err) => {
            this.error(err);
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

  return stream;
}
