import { createSubject } from '../../lib';
import { createStreamOperator, Emission, Stream, StreamOperator, Subscription } from '../abstractions';
import { asyncValue } from '../utils';

export const withLatestFrom = (...streams: Stream[]): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject<any>(); // Output stream for combined values
    let latestValues = streams.map(() => asyncValue());
    let subscriptions: Subscription[] = [];

    // Subscribe to each of the input streams
    streams.forEach((stream, index) => {
      const subscription = stream({
        next: async (emission) => {
          if (!emission.error) {
            latestValues[index].set(emission.value);
          } else {
            output.error(emission.error);
          }
        },
        complete: () => {}
      });
      subscriptions.push(subscription);
    });

    // Subscribe to the source stream
    const sourceSubscription = input({
      next: async (emission: Emission) => {
        if (!emission.error) {
          if (latestValues.every((v) => v.hasValue())) {
            // Emit combined values only if all streams have emitted at least once
            output.next([emission.value, ...latestValues.map(value => value.value())]);
          }
        } else {
          output.error(emission.error);
        }
      }, // Propagate errors to the output stream
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
