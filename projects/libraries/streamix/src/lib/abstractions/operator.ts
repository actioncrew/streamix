import { Stream } from "./stream";

export type Operator = {
  handle: (value: any) => any;
  type: string;
  name?: string;
};

export const createOperator = (name: string, handleFn: (value: any) => any): Operator => {
  return {
    name,
    handle: handleFn,
    type: 'operator'
  };
};

export type StreamMapper = Omit<Operator, "handle"> & {
  (stream: Stream<any>): Stream<any>;
}

export const createMapper = (name: string, handleFn: (stream: Stream) => Stream): StreamMapper => {
  const operator = handleFn as StreamMapper;
  Object.defineProperty(operator, 'name', { writable: true, enumerable: true, configurable: true });
  operator.name = name;
  operator.type = 'operator';
  return operator;
};
