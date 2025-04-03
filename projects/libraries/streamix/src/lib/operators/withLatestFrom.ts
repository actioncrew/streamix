import { createMapper, createReceiver, createSubscription, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export const withLatestFrom = (...streams: Stream<any>[]): StreamMapper => {
  const operator = function (input: Stream): Stream {
    const output = createSubject();

    let latestValues: any[] = new Array(streams.length).fill(undefined);
    let hasValue: boolean[] = new Array(streams.length).fill(false);
    let otherStreamsCompleted: boolean[] = new Array(streams.length).fill(false);
    let inputCompleted = false;
    let allCompleted = false;

    let inputSubscription: Subscription | null = null;
    let subscriptions: Subscription[] = [];

    const checkCompletion = () => {
      if (inputCompleted && otherStreamsCompleted.every((c) => c) && !allCompleted) {
        allCompleted = true;
        output.complete();
      }
    };

    subscriptions = streams.map((stream, index) =>
      stream.subscribe({
        next: (value) => {
          latestValues[index] = value;
          hasValue[index] = true;
        },
        error: (err) => output.error(err),
        complete: () => {
          otherStreamsCompleted[index] = true;
          checkCompletion();
        },
      })
    );

    inputSubscription = input.subscribe({
      next: (value) => {
        if (hasValue.every((v) => v)) {
          output.next([value, ...latestValues]);
        }
      },
      error: (err) => output.error(err),
      complete: () => {
        inputCompleted = true;
        checkCompletion();
      },
    });

    const originalSubscribe = output.subscribe;
    output.subscribe = (callbackOrReceiver?: ((value: any) => void) | Receiver<any>): Subscription => {
      const receiver = createReceiver(callbackOrReceiver);
      const subscription = originalSubscribe.call(output, receiver);

      return createSubscription(() => {
        subscriptions.forEach((sub) => sub.unsubscribe());
        if (inputSubscription) {
          inputSubscription.unsubscribe();
          inputSubscription = null;
        }
        subscription.unsubscribe();
      });
    };
    return output;
  };

  return createMapper('withLatestFrom', operator);
};
