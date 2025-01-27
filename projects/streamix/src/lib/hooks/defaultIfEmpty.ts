import { createStreamOperator, Emission, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const defaultIfEmpty = (defaultValue: any): StreamOperator => {
  const operator = (stream: Stream) => {
    let hasEmitted = false;  // Flag to track if the stream has emitted any values
    let completed = false;
    const output = createSubject<any>(); // The stream that will emit values, including the default value

    const subscription = stream({
      next: async (emission: Emission) => {
        if (!emission.error) {
          hasEmitted = true; // Mark that the stream has emitted a value
          output.next(emission.value); // Pass the value through to the output stream
        } else {
          output.error(emission.error);  // Pass the error through to the output stream
        }
      },
      complete: () => {
        output.complete();
      }
    });

    const originalComplete = output.complete.bind(output);

    output.complete = async () => {
      if(!completed) {
        completed = true;
        if (!hasEmitted) {
          output.next(defaultValue);
        }
        subscription.unsubscribe();
        originalComplete();
      }
    };

    return output;
  };

  return createStreamOperator('defaultIfEmpty', operator);
};
