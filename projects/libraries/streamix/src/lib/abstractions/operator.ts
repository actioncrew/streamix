// Core operator definition: transforms one iterator into another
export type Operator<T = any, R = any> = {
  name?: string;
  type: 'operator';
  apply: (source: AsyncIterator<T>) => AsyncIterator<R>;
};

// Create a named operator with a transform function (iterator in, iterator out)
export function createOperator<T = any, R = any>(
  name: string,
  transformFn: (source: AsyncIterator<T>) => AsyncIterator<R>
): Operator<T, R> {
  return {
    name,
    type: 'operator',
    apply: transformFn
  };
}
