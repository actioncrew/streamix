import { createMapper, Stream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

export const defaultIfEmpty = (defaultValue: any): StreamMapper => {
  const operator = (input: Stream, output: Subject<any>) => {
    let hasEmitted: boolean = false; // To track emitted values

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          hasEmitted = true; // Mark that a value has been emitted
          output.next(value); // Pass the value to the output stream
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
  };

  return createMapper('defaultIfEmpty', createSubject<any>(), operator);
};
