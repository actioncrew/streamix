import { Emission, Stream } from '../abstractions';

export type HookOperator = {
  callback: (params?: any) => void | Promise<void>;
}

export type StreamOperator = {
  (stream: Stream): Stream;
  type: string;
  name?: string;
}

export type Operator = {
  handle: (emission: Emission, stream: Stream) => Emission;
  type: string;
  name?: string;
};

// Assuming OperatorType has a certain structure, we can use type guards
export function isOperator(obj: any): obj is Operator {
  return obj && typeof obj === 'object' && typeof obj.handle === 'function' && typeof obj.run === 'undefined';
}

export const createOperator = (name: string, handleFn: (emission: Emission, stream: Stream) => Emission): Operator => {
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
