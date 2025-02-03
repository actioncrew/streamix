import { createEmission, createStream, eventBus, internals, Stream, Subscribable, Subscription } from '../abstractions';
import { counter, Counter } from '../utils';

export function zip(sources: Subscribable[]): Stream<any[]> {
  const queues = sources.map(() => [] as any[]); // Queues for values from each source
  const subscriptions: Subscription[] = []; // Track subscriptions for cleanup
  let activeSources = sources.length; // Number of active source streams
  let emittedValues: Counter = counter(0);

  const stream = createStream<any[]>(async function (this: Stream<any[]>): Promise<void> {
    sources.forEach((source, index) => {
      const subscription = source.subscribe({
        next: (value) => {
          if (stream[internals].shouldComplete()) return;

          queues[index].push(value); // Add value to the appropriate queue

          // Emit combined values when all queues have at least one value
          if (queues.every((queue) => queue.length > 0)) {
            const combined = queues.map((queue) => queue.shift()!); // Extract one value from each queue
             // Increment the emission count
            eventBus.enqueue({
              target: stream,
              payload: {
                emission: createEmission({ value: combined }),
                source: stream,
              },
              type: 'emission',
            });
            emittedValues.increment();
          }
        },
        complete: () => {
          activeSources--;
          if (activeSources === 0) {
            stream.complete(); // Complete the stream only when all emissions are emitted
          }
        },
        error: (err: any) => {
          // Emit an error if any source stream fails
          eventBus.enqueue({ target: stream, payload: { error: err }, type: 'error' });
        },
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

  stream.name = 'zip';
  return stream;
}
