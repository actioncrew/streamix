/**
 * Defines a stream operator that transforms an async iterator of type T into another of type R.
 * Operators are composable units used to manipulate or filter stream values.
 */
export type Operator<T = any, R = T> = {
  name?: string;
  type: 'operator';
  apply: (source: AsyncIterator<T>) => AsyncIterator<R>;
};

/**
 * Creates a reusable stream operator with a given name and transformation logic.
 * The operator can be applied to any compatible async iterator to produce transformed output.
 */
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
