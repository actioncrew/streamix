import { Emission, Stream } from '../abstractions';

export type HookOperator = {
  callback: (params?: any) => void | Promise<void>;
}

export type StreamOperator = {
  (stream: Stream): Stream;
}

export type Operator = {
  cleanup: () => void;
  handle: (emission: Emission, stream: Stream) => Emission;
  type: string;
  name?: string;
};

// Assuming OperatorType has a certain structure, we can use type guards
export function isOperator(obj: any): obj is Operator {
  return obj && typeof obj === 'object' && typeof obj.handle === 'function' && typeof obj.run === 'undefined';
}

export const createOperator = (handleFn: (emission: Emission, stream: Stream) => Emission): Operator => {
  let operator: Operator = {
    cleanup: function() {
      // Cleanup logic can be added here
    },

    handle: handleFn,

    type: 'operator'
  };

  return operator;
};
