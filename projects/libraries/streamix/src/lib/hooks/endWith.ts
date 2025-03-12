import { createMapper, Stream, StreamMapper } from '../abstractions';
import { createSubject } from '../streams';

export const endWith = (value: any): StreamMapper => {
  const operator = (input: Stream): Stream => {
    const output = createSubject<any>(); // Create the output stream

    // Subscribe to the original stream
    (async () => {
      try {
        // Iterate over the input stream asynchronously
        for await (const value of input) {
          output.next(value); // Forward emissions from the original stream
        }
      } catch (err) {
        output.error(err);
      } finally {
        // Emit the value at the end of the stream and complete the stream
        output.next(value);
        output.complete();
      }
    })();

    return output;
  };

  return createMapper('endWith', operator);
};
