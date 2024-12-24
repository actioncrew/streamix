import { createEmission, createStream, hooks, internals, Stream, Subscribable, Subscription } from '../abstractions';
import { catchAny, counter, Counter } from '../utils';
import { eventBus } from '../abstractions';

export function zip(sources: Subscribable[]): Stream<any[]> {
  const queues = sources.map(() => [] as any[]); // Queues for values from each source
  const subscriptions: Subscription[] = []; // Track subscriptions for cleanup
  let activeSources = sources.length; // Number of active source streams
  let emittedValues: Counter = counter(0);

  const stream = createStream<any[]>(async function (this: Stream<any[]>): Promise<void> {
    // Wait until all sources are completed or the main stream is completed
    const [error] = await catchAny(
      Promise.race([
        this[internals].awaitCompletion(),
        Promise.race(sources.map((source) => source[internals].awaitCompletion())),
      ])
    );

    if (error) {
      // Emit error if any source stream fails
      eventBus.enqueue({ target: this, payload: { error }, type: 'error' });
    }

    await this[internals].awaitCompletion();
    await emittedValues.waitFor(Math.min(...sources.map(source => source.emissionCounter)));
  });

  // Override the `run` method to start the source streams only after the main stream starts
  const originalRun = stream.run;
  stream.run = async function (): Promise<void> {
    // Subscribe to source streams when the `zip` stream is started
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

    // Run the main `zip` stream logic
    originalRun.call(stream);
    await stream[hooks].onComplete.waitForCompletion();
  };

  // Cleanup subscriptions when the `zip` stream terminates
  const originalComplete = stream.complete.bind(stream);
  stream.complete = async function (): Promise<void> {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    return originalComplete();
  };

  stream.name = 'zip';
  return stream;
}
