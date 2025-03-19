import { createMapper, createReceiver, createSubscription, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export const withLatestFrom = (...streams: Stream<any>[]): StreamMapper => {
  const operator = function (input: Stream): Stream {
    const output = createSubject();

    let latestValues: any[] = new Array(streams.length).fill(undefined);
    let hasValue: boolean[] = new Array(streams.length).fill(false);

    let inputSubscription: Subscription | null = null;
    let subscriptions: Subscription[] = [];

    if (subscriptions.length > 0) return output; // Prevent duplicate subscriptions

    // Subscribe to additional streams to collect the latest values
    subscriptions = streams.map((stream, index) =>
      stream.subscribe({
        next: (value) => {
          latestValues[index] = value; // Update the latest value for this stream
          hasValue[index] = true; // Mark this stream as having emitted a value
        },
        error: (err) => output.error(err), // Propagate errors to the output stream
      })
    );

    // Subscribe to the input stream
    inputSubscription = input.subscribe({
      next: (value) => {
        // Only emit if all dependent streams have emitted at least once
        if (hasValue.every((v) => v)) {
          output.next([value, ...latestValues]); // Emit the main value along with the latest values
        }
      },
      error: (err) => output.error(err), // Propagate errors to the output stream
      complete: () => {
        output.complete(); // Complete the output stream when the input stream completes
      },
    });

    // Override subscribe to defer subscriptions until the first subscriber attaches
    const originalSubscribe = output.subscribe;
    output.subscribe = (callbackOrReceiver?: ((value: any) => void) | Receiver<any>): Subscription => {

      const receiver = createReceiver(callbackOrReceiver);
      const subscription = originalSubscribe.call(output, receiver);

      return createSubscription(() => {
        subscription.unsubscribe();
        receiver.complete();

        // Cleanup all subscriptions
        subscriptions.forEach((sub) => sub.unsubscribe());
        subscriptions = [];

        if (inputSubscription) {
          inputSubscription.unsubscribe();
          inputSubscription = null;
        }
      });
    };
    return output;
  };

  return createMapper('withLatestFrom', operator);
};
