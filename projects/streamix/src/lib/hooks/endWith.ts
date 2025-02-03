import { BusEvent, createEmission, createOperator, Emission, Operator, Stream } from '../abstractions';

export const endWith = (value: any): Operator => {
  let boundStream: Stream;

  const init = function(this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream.emitter.once('complete', (params: any) => callback(this, params)); // Trigger the callback when the stream starts
  };

  const callback = (instance: Operator, _: any): (() => BusEvent) | void => {
    // Emit the provided initial value when the stream starts
    return () => ({ target: boundStream, payload: { emission: createEmission({ value }), source: instance }, type: 'emission' });
  };

  const handle = (emission: Emission): Emission => {
    return emission; // Pass the emission forward without modification
  };

  const operator = createOperator(handle);
  operator.name = 'endWith';
  operator.init = init;
  return operator;
};
