export type Operator = {
  name?: string;
  type: 'operator';
  apply: (source: Iterable<any>) => Iterable<any>;
};

export const createOperator = (
  name: string,
  transformFn: (source: Iterator<any>) => { next: () => IteratorResult<any> }
): Operator => {
  return {
    name,
    type: 'operator',
    apply(source) {
      const sourceIter = source[Symbol.iterator]();
      const state = transformFn(sourceIter);
      return {
        [Symbol.iterator]() {
          return this;
        },
        next() {
          return state.next();
        }
      };
    }
  };
};
