import { createStream, Subscribable, Stream, Subscription, createEmission, hooks, flags, internals } from '../abstractions';
import { eventBus } from '../abstractions';

export function iif<T>(
  condition: () => boolean, // Evaluate condition once at initialization
  trueStream: Subscribable<T>, // Stream to choose when condition is true
  falseStream: Subscribable<T> // Stream to choose when condition is false
): Stream<T> {
  let selectedStream: Subscribable<T> | undefined;
  let subscription!: Subscription;

  // Create and return the stream with the defined run function
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    // Choose the appropriate stream based on the condition
    selectedStream = condition() ? trueStream : falseStream;

    // Start the selected stream
    subscription = selectedStream.subscribe((value) => handleEmission(this, value));

    this[hooks].onComplete.once(() => {
      this[flags].isAutoComplete = true;
      subscription.unsubscribe()
    });

    // Wait for the completion of the selected stream
    await selectedStream[internals].awaitCompletion();
  });

  // Handle emissions from the selected stream
  const handleEmission = async (stream: Stream<T>, value: T): Promise<void> => {
    if (stream[internals].shouldComplete()) {
      return;
    }

    eventBus.enqueue({ target: stream, payload: { emission: createEmission({ value }), source: stream }, type: 'emission' });
  };

  stream.name = "iif";
  return stream;
}
