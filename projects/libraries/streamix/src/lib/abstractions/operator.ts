export type Operator = {
  name?: string;
  type: 'operator';
  apply: (source: AsyncIterable<any>) => AsyncIterable<any>;
};

export const createOperator = (
  name: string,
  transformFn: (source: AsyncIterator<any>) => { next: () => Promise<IteratorResult<any>> }
): Operator => {
  return {
    name,
    type: 'operator',
    apply(source) {
      const sourceIter = source[Symbol.asyncIterator]();
      const state = transformFn(sourceIter);

      const iterator: AsyncIterator<any> = {
        next: state.next
      };

      const iterable: AsyncIterable<any> = {
        [Symbol.asyncIterator]() {
          return iterator;
        }
      };

      return iterable;
    }
  };
};
