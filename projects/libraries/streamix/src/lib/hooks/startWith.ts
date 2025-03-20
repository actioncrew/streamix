import { createMapper, Stream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createBehaviorSubject } from '../streams';

export const startWith = (initialValue: any): StreamMapper => {
  const operator = (input: Stream): Stream => {
    const output = createBehaviorSubject<any>(initialValue); // Create the output stream

    // Subscribe to the original stream
    (async () => {
      try {
        // Iterate over the input stream asynchronously
        for await (const value of eachValueFrom(input)) {
          output.next(value); // Forward emissions from the original stream
        }
      } catch (err) {
        output.error(err);
      } finally {
        // Complete the output stream once the original stream completes
        output.complete();
      }
    })();

    return output;
  };

  return createMapper('startWith', operator);
};
