import { Operator, Stream } from "../abstractions";

export type Transformer = Omit<Operator, "handle"> & {
  (stream: Stream<any>): Stream<any>;
}

export const createTransformer = (name: string, handleFn: (stream: Stream) => Stream): Transformer => {
  const operator = handleFn as Transformer;
  Object.defineProperty(operator, 'name', { writable: true, enumerable: true, configurable: true });
  operator.name = name;
  operator.type = 'operator';
  return operator;
};
