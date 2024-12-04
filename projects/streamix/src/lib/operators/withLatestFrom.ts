import { flags } from './../abstractions/subscribable';
import { createEmission, createOperator, Emission, eventBus, hooks, internals, Operator, Stream, Subscribable, Subscription } from '../abstractions';
import { asyncValue } from '../utils';

export const withLatestFrom = (...streams: Subscribable[]): Operator => {
  let latestValues = streams.map(() => asyncValue());
  let subscriptions: Subscription[] = [];

  // Initialize the operator and set up the subscription-based handling
  const init = (stream: Stream) => {
    // Override the `run` method to start other streams
    const originalRun = stream.run;

    stream.run = async () => {
      // Subscribe to other streams and collect their latest values
      streams.forEach((source, index) => {
        const latestValue = latestValues[index];

        // Subscribe to each source stream
        const subscription = source.subscribe(value => latestValue.set(value));

        // Store each subscription for later cleanup
        subscriptions.push(subscription);
      });

      // Wait until all streams are started before running the main stream
      await Promise.all(subscriptions.map(sub => sub.started));
      await originalRun.call(stream);
    };

    // Cleanup on stream termination
    stream[hooks].finalize.once(finalize);
  };

  // Cleanup all subscriptions
  const finalize = async () => {
    await Promise.all(subscriptions.map(sub => sub.unsubscribe()));
    latestValues = [];
    subscriptions = [];
  };

  // Handle emissions by combining the latest values from all streams
  const handle = async function (this: Operator, emission: Emission, stream: Subscribable): Promise<Emission> {
    if (stream[internals].shouldComplete()) {
      await Promise.all(streams.map(source => source[flags].isStopRequested = true));
    }

    // Wait for all latest values to be available
    const latestValuesPromise = Promise.all(latestValues.map((value) => value()));

    // Monitor for any stream or main stream completion
    const terminationPromises = Promise.race([
      stream[internals].awaitCompletion(),
      ...streams.map(source => source[internals].awaitCompletion()),
    ]);

    emission.pending = true;

    const delayedEmission = createEmission({ value: emission.value });
    emission.link(delayedEmission);

    queueMicrotask(async () => {
      await Promise.race([latestValuesPromise, terminationPromises]);

      // Update the emission with the latest values
      if (latestValues.every((value) => value.hasValue())) {
        delayedEmission.value = [delayedEmission.value, ...latestValues.map(value => value.value())];

        eventBus.enqueue({
          target: stream,
          payload: { emission: delayedEmission, source: this },
          type: 'emission',
        });
      } else {
        delayedEmission.failed = true;
        delayedEmission.error = new Error("Some streams are completed without emitting value.");
        finalize();
      }

      emission.finalize();
    });

    return emission;
  }

  // Create and return the operator
  const operator = createOperator(handle);
  operator.name = 'withLatestFrom';
  operator.init = init;
  return operator;
};
