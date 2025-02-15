import { Emission, Stream } from '../abstractions';

export type StreamOperator<T = any, K = any> = Omit<Operator, "handle"> & {
  (stream: Stream<T>): Stream<K>;
}

export type Operator = {
  handle: (emission: Emission) => Emission;
  type: string;
  name?: string;
};

export const createOperator = (name: string, handleFn: (emission: Emission) => Emission): Operator => {
  return {
    name,
    handle: handleFn,
    type: 'operator'
  };
};

export const createStreamOperator = (name: string, handleFn: (stream: Stream) => Stream): StreamOperator => {
  const operator = handleFn as StreamOperator;
  Object.defineProperty(operator, 'name', { writable: true, enumerable: true, configurable: true });
  operator.name = name;
  operator.type = 'operator';
  return operator;
};
