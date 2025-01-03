import { Emission, Stream, Subscribable } from '../abstractions';
import { internals } from './subscribable';

export type HookOperator = {
  callback: (params?: any) => void | Promise<void>;
}

export type StreamOperator = {
  get stream(): Subscribable;
}

export type Operator = {
  init: (stream: Stream) => void;
  cleanup: () => void;
  process: (emission: Emission, chunk: Stream) => Emission;
  handle: (emission: Emission, chunk: Stream) => Emission;
  clone: () => Operator;
  next?: Operator; // Optional chaining for next operators
  type: string;
  name?: string;
};

// Assuming OperatorType has a certain structure, we can use type guards
export function isOperator(obj: any): obj is Operator {
  return obj && typeof obj === 'object' && typeof obj.handle === 'function' && typeof obj.run === 'undefined';
}

export const createOperator = (handleFn: (emission: Emission, stream: Subscribable) => Emission): Operator => {
  let operator: Operator = {
    next: undefined,

    init: function(_: Stream) {
      // Initialization logic can be added here
    },

    cleanup: function() {
      // Cleanup logic can be added here
    },

    process: function (emission: Emission, chunk: Stream): Emission {
      try {
        if ('stream' in this) {
          chunk.emissionCounter++;
        }

        // Handle the emission with the provided handle function
        emission = handleFn.call(this, emission, chunk);

        if (this === chunk[internals].tail && !emission.phantom && !emission.failed && !emission.pending && !('stream' in this)) {
          chunk.emissionCounter++;
        }

        // If there's a next operator and the emission is valid, pass it to the next operator
        if (this.next && !emission.phantom && !emission.failed && !emission.pending) {
          return this.next.process.call(this.next, emission, chunk);
        } else {
          return emission; // Return the processed emission
        }
      } catch (error) {
        emission.failed = true;
        emission.error = error;
        throw error; // Rethrow the error for upstream handling
      }
    },

    clone: function (): Operator {
      const clonedOperator = Object.create(Object.getPrototypeOf(this)); // Create a new object with the same prototype
      Object.assign(clonedOperator, this); // Copy all properties from the current instance to the new object
      clonedOperator.next = undefined; // Avoid recursive copy of the next operator
      return clonedOperator; // Return the cloned operator
    },

    handle: handleFn,

    type: 'operator'
  };

  return operator;
};
