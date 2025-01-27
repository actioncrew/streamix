import { createEmission, createStream, Emission, internals, Stream, Subscription } from '../abstractions';
import { counter, Counter } from '../utils';

export function zip(sources: Stream[]): Stream<any[]> {
  const queues = sources.map(() => [] as any[]); // Queues for values from each source
  const subscriptions: Subscription[] = []; // Track subscriptions for cleanup
  let activeSources = sources.length; // Number of active source streams
  let emittedValues: Counter = counter(0);

  const stream = createStream<any[]>('zip', async function (this: Stream<any[]>): Promise<void> {
    sources.forEach((source, index) => {
      const subscription = source({
        next: async (emission: Emission) => {
          if (!emission.error) {
            if (this[internals].shouldComplete()) return;

            queues[index].push(emission.value); // Add value to the appropriate queue

            // Emit combined values when all queues have at least one value
            if (queues.every((queue) => queue.length > 0)) {
              const combined = queues.map((queue) => queue.shift()!); // Extract one value from each queue
               // Increment the emission count
              this.next(createEmission({ value: combined }));
              emittedValues.increment();
            }
          } else {
            this.error(emission.error);
          }
        },
        complete: () => {
          activeSources--;
          if (activeSources === 0) {
            stream.complete(); // Complete the stream only when all emissions are emitted
          }
        }
      });

      subscriptions.push(subscription); // Store subscriptions for cleanup
    });

    await this[internals].awaitCompletion();
    await emittedValues.waitFor(Math.min(...sources.map(source => source.emissionCounter)));
  });

  // Cleanup subscriptions when the `zip` stream terminates
  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function (): Promise<void> {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    return originalComplete();
  };

  return stream;
}
