import { BusEvent, Chunk, createEmission, hooks } from '../abstractions';
import { Emission, Subscribable, createOperator, Operator } from '../abstractions';

export const startWith = (value: any): Operator => {
  let boundStream: Chunk;

  const init = function(this: Operator, stream: Chunk) {
    boundStream = stream;
    boundStream[hooks].onStart.chain((params: any) => callback(this, params)); // Trigger the callback when the stream starts
  };

  const callback = (instance: Operator, params?: any): (() => BusEvent) | void => {
    // Emit the provided initial value when the stream starts
    return () => ({ target: boundStream, payload: { emission: createEmission({ value }), source: instance }, type: 'emission' });
  };

  const handle = (emission: Emission, stream: Subscribable): Emission => {
    return emission; // Simply pass the emission without modification
  };

  const operator = createOperator(handle);
  operator.name = 'startWith';
  operator.init = init;
  return operator;
};
