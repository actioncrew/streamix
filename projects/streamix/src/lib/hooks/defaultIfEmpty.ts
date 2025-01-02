import { Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const defaultIfEmpty = (defaultValue: any): StreamOperator => {
  return (stream: Stream) => {
    let hasEmitted = false;  // Flag to track if the stream has emitted any values
    let completed = false;
    const output = createSubject<any>(); // The stream that will emit values, including the default value

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

    const originalComplete = output.complete.bind(output);

    output.complete = async () => {
      if(!completed) {
        completed = true;
        return new Promise((resolve) => {
          const timerId = setTimeout(() => {
            clearTimeout(timerId);
            if (!hasEmitted) {
              output.next(defaultValue);
            }
            subscription.unsubscribe();
            originalComplete();
            resolve();
          }, 0);
        });
      }
    };

    return output;
  };
};
