import { createSubject } from '../../lib';
import { createStreamOperator, Stream, StreamOperator, Subscription } from '../abstractions';
import { asyncValue } from '../utils';

export const withLatestFrom = (...streams: Stream[]): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject<any>(); // Output stream for combined values
    let latestValues = streams.map(() => asyncValue());
    let subscriptions: Subscription[] = [];

    // Subscribe to each of the input streams
    streams.forEach((stream, index) => {
      const subscription = stream.subscribe({
        next: (value) => {
          latestValues[index].set(value);
        },
        error: (err) => output.error(err)
      });
      subscriptions.push(subscription);
    });

    // Subscribe to the source stream
    const sourceSubscription = input.subscribe({
      next: (value) => {
        if (latestValues.every((v) => v.hasValue())) {
          // Emit combined values only if all streams have emitted at least once
          output.next([value, ...latestValues.map(value => value.value())]);
        }
      },
      error: (err) => output.error(err), // Propagate errors to the output stream
      complete: () => {
        // Complete the output stream after the source completes
        output.complete();
      },
    });

    // Add the source subscription to the list of subscriptions
    subscriptions.push(sourceSubscription);

    // Clean up all subscriptions when the output stream is finalized
    output.emitter.once('finalize', () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    });

    return output; // Return the resulting stream
  };

  return  createStreamOperator('withLatestFrom', operator);
};
