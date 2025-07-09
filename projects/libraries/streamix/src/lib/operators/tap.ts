import { createOperator } from '../abstractions';
import { CallbackReturnType } from './../abstractions/receiver';

export const tap = (tapFunction: (value: any) => CallbackReturnType) =>
  createOperator('tap', (source) => {
    return {
      async next() {
        const result = await source.next();

        if (result.done) {
          return { done: true, value: undefined };
        }

        await tapFunction(result.value); // Apply side effect
        return { done: false, value: result.value };
      }
    };
  });
