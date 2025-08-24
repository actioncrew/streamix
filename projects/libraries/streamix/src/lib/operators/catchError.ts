import { CallbackReturnType, createOperator, createStreamResult, DONE, Operator } from '../abstractions';

/**
 * Creates a stream operator that catches errors from the source stream and handles them.
 *
 * This operator listens for errors from the upstream source. When the first error is
 * caught, it invokes a provided `handler` callback and then immediately completes
 * the stream, preventing the error from propagating further down the pipeline.
 *
 * - **Error Handling:** The `handler` is executed only for the first error encountered.
 * - **Completion:** After an error is caught and handled, the operator completes,
 * terminating the stream's flow.
 * - **Subsequent Errors:** Any errors after the first will be re-thrown.
 *
 * This is useful for error-handling strategies where you want to perform a specific
 * cleanup action and then gracefully terminate the stream.
 *
 * @template T The type of the values emitted by the stream.
 * @param handler The function to call when an error is caught. It can return a `void` or a `Promise<void>`.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const catchError = <T = any>(
  handler: (error: any) => CallbackReturnType = () => {} // Handler still returns void
) =>
  createOperator<T, T>('catchError', function (this: Operator, source) {
    let errorCaughtAndHandled = false;
    let completed = false;

    return {
      next: async () => {
        while (true) {
          // If an error was already caught and handled, or we're completed, this operator is done
          if (errorCaughtAndHandled || completed) {
            return DONE;
          }

          try {
            const result = createStreamResult(await source.next());
            if (result.done) {
              completed = true; // Source completed without error
              return DONE;
            }

            return result; // Emit value from source
          } catch (error) {
            // An error occurred from the source
            if (!errorCaughtAndHandled) { // Only handle the first error
              await handler(error); // Call the provided handler
              errorCaughtAndHandled = true; // Mark as handled
              completed = true;
              // After handling, this operator completes
              return DONE;
            } else {
              // If subsequent errors occur (shouldn't happen with a proper upstream), re-throw
              throw error;
            }
          }
        }
      },
    };
  });
