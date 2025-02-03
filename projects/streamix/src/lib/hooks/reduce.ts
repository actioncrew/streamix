import { BusEvent, createEmission, createOperator, Emission, Operator, Stream } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any): Operator => {
  let boundStream: Stream;
  let accumulatedValue = seed;

  const init = function (this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream.emitter.once('complete', () => callback(this)); // Trigger the callback when the stream completes
  };

  const callback = (instance: Operator): (() => BusEvent) | void => {
    // Emit the accumulated value once the stream completes
    return () => ({ target: boundStream,  payload: { emission: createEmission({ value: accumulatedValue }), source: instance }, type: 'emission' });
  };

  const handle = (emission: Emission): Emission => {
    // Accumulate the value using the provided accumulator function
    accumulatedValue = accumulator(accumulatedValue, emission.value!);
    emission.phantom = true; // Mark the emission as phantom
    return emission; // Return the emission
  };

  const operator = createOperator(handle);
  operator.name = 'reduce';
  operator.init = init;
  return operator;
};
