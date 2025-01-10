import { createSubject } from '../../lib';
import { createStreamOperator, Stream, StreamOperator } from '../abstractions';

export const delay = (ms: number): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject<any>(); // Create a subject for the delayed stream
    let pendingPromises: Promise<void>[] = []; // Array to store pending promises
    let isCompleteCalled = false; // Flag to handle the first complete call

    // Subscribe to the original stream
    const subscription = input({
      next: (value) => {
        const promise = new Promise<void>((resolve) => {
          const timerId = setTimeout(() => {
            output.next(value); // Emit to the delayed stream after delay
            resolve(); // Resolve the promise when timeout completes
          }, ms);

          // Track the timeout for cleanup
          output.emitter.once('finalize', () => {
            clearTimeout(timerId);
          });
        });

        pendingPromises.push(promise); // Add promise to the pending array
      },
      complete: () => {
        subscription.unsubscribe(); // Unsubscribe from the source stream

        if (!isCompleteCalled) {
          isCompleteCalled = true;

          // Complete immediately if no pending promises
          if (pendingPromises.length === 0) {
            output.complete();
          } else {
            // Wait for all pending promises to resolve before completing
            Promise.all(pendingPromises).then(() => {
              output.complete(); // Complete after all promises resolve
            });
          }
        }
      },
    });

    // Return the delayed stream
    return output;
  };

  return createStreamOperator('delay', operator);
};
