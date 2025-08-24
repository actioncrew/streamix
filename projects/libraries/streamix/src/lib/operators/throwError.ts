import { createOperator, createStreamResult, DONE, Operator } from '../abstractions';

/**
 * Creates a stream operator that immediately throws an error with the provided message.
 *
 * This operator is a source operator that is used to create a stream that immediately
 * fails. When a consumer requests a value by calling `next()`, the operator
 * will throw an `Error` with the given `message`, without emitting any values.
 *
 * This is useful for testing error handling logic in a stream pipeline or for
 * explicitly modeling a failed asynchronous operation.
 *
 * @template T The type of the values in the stream (this is a formality, as no values are emitted).
 * @param message The error message to be thrown.
 * @returns An `Operator` instance that creates a stream which errors upon its first request.
 */
export const throwError = <T = any>(message: string) =>
  createOperator<T, never>('throwError', function (this: Operator, source) {

    return {
      next: async () => {
        while (true) {
          const result = createStreamResult(await source.next());
          if (result.done) return DONE as any;
          break;
        }
        throw new Error(message);
      }
    };
  });
