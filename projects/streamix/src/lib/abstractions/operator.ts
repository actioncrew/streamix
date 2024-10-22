import { Stream, Subscribable, Emission, Chunk } from '../abstractions';

export type OperatorType = {
  init: (stream: Stream) => void;
  cleanup: () => Promise<void>;
  process: (emission: Emission, chunk: Chunk) => Promise<Emission>;
  handle: (emission: Emission, chunk: Chunk) => Promise<Emission>;
  clone: () => OperatorType;
  setNext: (nextOperator: OperatorType) => void;
  next?: OperatorType; // Optional chaining for next operators
};

// Assuming OperatorType has a certain structure, we can use type guards
export function isOperatorType(obj: any): obj is OperatorType {
  return obj && typeof obj === 'object' && typeof obj.handle === 'function' && typeof obj.stream === 'object';
}

export const createOperator = (handleFn: (emission: Emission, stream: Subscribable) => Promise<Emission>): OperatorType => {
  const operator: OperatorType = {
    next: undefined,

    init: (stream: Stream) => {
      // Initialization logic can be added here
      console.log('Operator initialized with stream:', stream);
    },

    cleanup: async () => {
      // Cleanup logic can be added here
      console.log('Cleaning up operator');
    },

    process: async (emission: Emission, chunk: Chunk): Promise<Emission> => {
      try {
        const actualStream = chunk.stream;
        // Handle the emission with the provided handle function
        emission = await handleFn(emission, actualStream);

        // If there's a next operator and the emission is valid, pass it to the next operator
        if (operator.next && !emission.isPhantom && !emission.isFailed) {
          return operator.next.process(emission, chunk);
        } else {
          return emission; // Return the processed emission
        }
      } catch (error) {
        emission.isFailed = true;
        emission.error = error;
        throw error; // Rethrow the error for upstream handling
      }
    },

    setNext: (nextOperator: OperatorType) => {
      operator.next = nextOperator; // Assign the next operator
    },

    clone: function (): OperatorType {
      const clonedOperator = Object.create(Object.getPrototypeOf(this)); // Create a new object with the same prototype
      Object.assign(clonedOperator, this); // Copy all properties from the current instance to the new object
      clonedOperator.next = undefined; // Avoid recursive copy of the next operator
      return clonedOperator; // Return the cloned operator
    },

    handle: handleFn
  };

  return operator;
};
