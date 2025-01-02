import { Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const defaultIfEmpty = (defaultValue: any): StreamOperator => {
  return (stream: Stream) => {
    let hasEmitted = false;  // Flag to track if the stream has emitted any values
    let completed = false;
    const output = createSubject<any>(); // The stream that will emit values, including the default value

    // const callback = function (this: Operator): (() => BusEvent) | void {
    //   if (!hasEmitted) {
    //     // If nothing has been emitted, emit the default value
    //     let emission = createEmission({ value: defaultValue });
    //     stream.next(emission);
    //     stream.complete();
    //   }
    // };

    // stream[hooks].onComplete.once(stream, callback); // Chain the callback to be triggered on stream completion

    // Subscribe to the original stream
    const subscription = stream.subscribe({
      next: (value) => {
        hasEmitted = true; // Mark that the stream has emitted a value
        output.next(value); // Pass the value through to the output stream
      },
      error: (error) => {
        output.error(error);  // Pass the error through to the output stream
      },
      complete: () => {
        output.complete();
      }
    });

    // Ensure processedStream.complete() also triggers logic

    const originalComplete = output.complete.bind(output);
    const delay = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const timerId = setTimeout(() => {
          clearTimeout(timerId); // Ensure cleanup
          resolve();
        }, ms);
      });

    output.complete = async () => {
      if(!completed) {
        completed = true;
        await delay(0);
        if (!hasEmitted) {
          // If no value was emitted, emit the default value
          output.next(defaultValue);
        }
        subscription.unsubscribe(); // Unsubscribe from the original stream
        originalComplete();
      }
    };

    // Return the new stream with the default value logic applied
    return output;
  };
};
