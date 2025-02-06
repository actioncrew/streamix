import { createStreamOperator, Stream, StreamOperator, Subscription } from "../abstractions";
import { createSubject } from "../streams/subject";

export const withLatestFrom = (...streams: Stream<any>[]): StreamOperator => {
  const operator = (inputStream: Stream<any>): Stream<any> => {
    const output = createSubject<any>();
    const latestValues: any[] = new Array(streams.length).fill(undefined);
    const hasValue: boolean[] = new Array(streams.length).fill(false);
    let subscriptions: Subscription[] = [];
    let allStreamsHaveEmitted = false;

    // Subscribe to each other stream
    streams.forEach((stream, index) => {
      subscriptions.push(
        stream.subscribe({
          next: (value) => {
            latestValues[index] = value;
            hasValue[index] = true;
            allStreamsHaveEmitted = hasValue.every((v) => v); // Ensure all have emitted at least once
          },
          error: (err) => output.error(err),
          complete: () => {} // Completion of other streams does not affect the main stream
        })
      );
    });

    // Subscribe to the main stream
    inputStream.subscribe({
      next: (mainValue) => {
        if (allStreamsHaveEmitted) {
          output.next([mainValue, ...latestValues]);
        }
      },
      error: (err) => output.error(err),
      complete: () => output.complete()
    });

    return output;
  };

  return createStreamOperator('withLatestFrom', operator);
};
