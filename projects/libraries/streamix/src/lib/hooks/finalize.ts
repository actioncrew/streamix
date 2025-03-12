import { createStreamOperator, Stream, Transformer } from '../abstractions';
import { createSubject } from '../streams';

export const finalize = (callback: () => void | Promise<void>): Transformer => {
  const operator = (stream: Stream): Stream => {
    const output = createSubject();

    let finalized = false;  // Flag to ensure `callback` is called only once

    (async () => {
      try {
        // Iterate over the stream asynchronously
        for await (const value of stream) {
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

    return output;
  };

  return createStreamOperator('finalize', operator);
};
