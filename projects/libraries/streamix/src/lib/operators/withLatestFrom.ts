import { createMapper, createReceiver, createSubscription, Receiver, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject, Subject } from "../streams";

export const withLatestFrom = (...streams: Stream<any>[]): StreamMapper => {
  let latestValues: any[] = new Array(streams.length).fill(undefined);
  let hasValue: boolean[] = new Array(streams.length).fill(false);
  let otherStreamsCompleted: boolean[] = new Array(streams.length).fill(false);
  let inputCompleted = false;
  let allCompleted = false;

  let inputSubscription: Subscription | null = null;
  let subscriptions: Subscription[] = [];


  const operator = function (input: Stream, output: Subject) {
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

    const checkCompletion = () => {
      if (inputCompleted && otherStreamsCompleted.every((c) => c) && !allCompleted) {
        allCompleted = true;
        output.complete();
      }
    };

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
  };

  return createMapper('withLatestFrom', createSubject(), operator);
};
