import { BusEvent, createEmission, eventBus, hooks } from '../abstractions';
import { Emission, Subscribable, Stream, createOperator, Operator } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any): Operator => {
  let boundStream: Stream;
  let accumulatedValue = seed;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream[hooks].onComplete.chain(callback); // Trigger the callback when the stream completes
  };

  const callback = (): (() => BusEvent) | void => {
    // Emit the accumulated value once the stream completes
    return () => ({ target: boundStream,  payload: { emission: createEmission({ value: accumulatedValue }), source: boundStream }, type: 'emission' });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
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
