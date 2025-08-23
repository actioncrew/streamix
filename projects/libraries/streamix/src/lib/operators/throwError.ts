import { COMPLETE, createOperator } from '../abstractions';
import { StreamResult } from './../abstractions/stream';

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
  createOperator<T, never>('throwError', (source, context) => {

    return {
      async next(): Promise<StreamResult<never>> {
        while (true) {
          const result = await source.next();
          if (result.done) return COMPLETE;
          if (result.phantom) { context.phantomHandler(result.value); continue; }
          break;
        }
        throw new Error(message);
      }
    };
  });
