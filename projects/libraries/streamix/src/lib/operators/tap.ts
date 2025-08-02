import { createOperator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';

/**
 * Performs a side-effect for each value from the source without modifying the value.
 * The side-effect function can be asynchronous.
 */
export const tap = <T = any>(tapFunction: (value: T) => CallbackReturnType) =>
  createOperator<T, T>('tap', (source) => {
    return {
      async next(): Promise<IteratorResult<T>> {
        const result = await source.next();

        if (result.done) {
          return { done: true, value: undefined };
        }

        await tapFunction(result.value); // side-effect
        return { done: false, value: result.value };
      }
    };
  });
