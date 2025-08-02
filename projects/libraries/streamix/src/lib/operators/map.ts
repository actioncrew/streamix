import { CallbackReturnType, createOperator } from '../abstractions';

/**
 * Applies a transformation function to each value emitted by the source stream,
 * emitting the transformed values.
 */
export const map = <T = any, R = any>(
  transform: (value: T, index: number) => CallbackReturnType<R>
) =>
  createOperator<T, R>('map', (source) => {
    let index = 0;
    return {
      async next(): Promise<IteratorResult<R>> {
        const result = await source.next();
        if (result.done) return result;
        return {
          value: await transform(result.value, index++),
          done: false,
        };
      },
    };
  });
