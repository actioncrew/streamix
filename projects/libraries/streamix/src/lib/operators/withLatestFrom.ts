import { eachValueFrom } from '@actioncrew/streamix';
import { createOperator, createReceiver, createSubscription, Receiver, Stream, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export function withLatestFrom<T, R extends any[]>(
  ...streams: Stream<any>[]
) {
  return createOperator("withLatestFrom", (source) => {
    const output = createSubject<[T, ...R]>();

    const latestValues: any[] = new Array(streams.length).fill(undefined);
    const hasValue: boolean[] = new Array(streams.length).fill(false);
    const otherStreamsCompleted: boolean[] = new Array(streams.length).fill(false);

    let inputCompleted = false;
    let allCompleted = false;

    let inputSubscription: Subscription | null = null;
    const subscriptions: Subscription[] = [];

    const checkCompletion = () => {
      if (
        inputCompleted &&
        otherStreamsCompleted.every((completed) => completed) &&
        !allCompleted
      ) {
        allCompleted = true;
        output.complete();
      }
    };

    // Subscribe to other streams to track latest values and completion
    for (let i = 0; i < streams.length; i++) {
      const subscription = streams[i].subscribe({
        next: (value) => {
          latestValues[i] = value;
          hasValue[i] = true;
        },
        error: (err) => {
          output.error(err);
        },
        complete: () => {
          otherStreamsCompleted[i] = true;
          checkCompletion();
        },
      });
      subscriptions.push(subscription);
    }

    // Subscribe to the main source stream
    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) {
            inputCompleted = true;
            checkCompletion();
            break;
          }

          if (hasValue.every(Boolean)) {
            output.next([value, ...latestValues] as [T, ...R]);
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();

    // Override output.subscribe to handle unsubscriptions cleanly
    const originalSubscribe = output.subscribe.bind(output);
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

    return eachValueFrom(output);
  });
}
