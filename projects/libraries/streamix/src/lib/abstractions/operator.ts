export type Operator = {
  name?: string;
  type: 'operator';
  apply: (source: AsyncIterable<any>) => AsyncIterable<any>;
};

export const createOperator = (
  name: string,
  transformFn: (source: AsyncIterator<any>) => { next: () => Promise<IteratorResult<any>> }
): AsyncOperator => {
  return {
    name,
    type: 'operator',
    apply(source) {
      const sourceIter = source[Symbol.asyncIterator]();
      const state = transformFn(sourceIter);
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        async next() {
          return state.next();
        }
      };
    }
  };
};
