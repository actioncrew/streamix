import { createMapper, Stream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

export const finalize = (callback: () => void | Promise<void>): StreamMapper => {
  const operator = (input: Stream, output: Subject) => {
    let finalized = false;  // Flag to ensure `callback` is called only once

    (async () => {
      try {
        // Iterate over the stream asynchronously
        for await (const value of eachValueFrom(input)) {
          output.next(value);
        }
      } catch (err) {
        // If an error occurs, forward the error and trigger the finalize callback
        output.error(err);
      } finally {
        if (finalized) return;  // Prevent multiple calls to `callback`
        finalized = true;

        try {
          await callback();  // Execute the callback, it could be async
        } catch (error) {
          output.error(error);  // Forward any error from the callback
        } finally {
          output.complete();  // Complete the output stream
        }
      }
    })();
  };

  return createMapper('finalize', createSubject(), operator);
};
