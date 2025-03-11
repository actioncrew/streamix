import { createStreamOperator, Stream, Transformer } from '../abstractions';
import { createSubject } from '../streams';

export const defaultIfEmpty = (defaultValue: any): Transformer => {
  const operator = (input: Stream) => {
    const output = createSubject<any>(); // The stream that will emit values, including the default value
    let hasEmitted: boolean = false; // To track emitted values

    (async () => {
      try {
        for await (const emission of input) {
          hasEmitted = true; // Mark that a value has been emitted
          output.next(emission.value); // Pass the value to the output stream
        }

        // After the stream finishes emitting values, check if any values were received
        if (hasEmitted === false) {
          output.next(defaultValue); // Emit the default value if no emissions occurred
        }
      } catch (err) {
        output.error(err); // If an error occurs during iteration, propagate it
      } finally {
        output.complete(); // Complete the output stream
      }
    })();

    return output;
  };

  return createStreamOperator('defaultIfEmpty', operator);
};
