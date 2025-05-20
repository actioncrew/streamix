export type Operator = {
  name?: string;
  type: 'operator';
  apply: (source: AsyncIterable<any>) => AsyncIterable<any>;
};

export function createOperator<T = any, R = any>(
  name: string,
  transformFn: (sourceIterator: AsyncIterator<T>) => AsyncIterator<R> // <--- transformFn expects AsyncIterator
): Operator {
  return {
    name,
    type: "operator",
    apply: (sourceIterable: AsyncIterable<T>) => {
      return {
        [Symbol.asyncIterator]() {
          const actualSourceIterator = sourceIterable[Symbol.asyncIterator]();
          return transformFn(actualSourceIterator);
        }
      };
    }
  };
}
