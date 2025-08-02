import { CallbackReturnType, createOperator } from '../abstractions';

export const catchError = <T = any>(
  handler: (error: any) => CallbackReturnType = () => {} // Handler still returns void
) =>
  createOperator<T, T>('catchError', (source) => {
    let errorCaughtAndHandled = false;
    let sourceCompleted = false;

    return {
      async next(): Promise<IteratorResult<T>> {
        // If an error was already caught and handled, this operator is done
        if (errorCaughtAndHandled || sourceCompleted) {
          return { value: undefined, done: true };
        }

        try {
          const result = await source.next();
          if (result.done) {
            sourceCompleted = true; // Source completed without error
            return { value: undefined, done: true };
          }
          return result; // Emit value from source
        } catch (error) {
          // An error occurred from the source
          if (!errorCaughtAndHandled) { // Only handle the first error
            await handler(error); // Call the provided handler
            errorCaughtAndHandled = true; // Mark as handled
            // After handling, this operator completes
            return { value: undefined, done: true };
          } else {
            // If subsequent errors occur (shouldn't happen with a proper upstream), re-throw
            throw error;
          }
        }
      },
    };
  });
