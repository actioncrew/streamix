import { createEmission, eventBus } from '../abstractions';
import { Emission, Subscribable, Stream, createOperator, Operator } from '../abstractions';

export const endWith = (value: any): Operator => {
  let boundStream: Stream;

  const init = function(this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream.onComplete.chain((params: any) => callback(this, params)); // Trigger the callback when the stream starts
  };

  const callback = async (instance: Operator, params?: any): Promise<void> => {
    // Emit the provided initial value when the stream starts
    boundStream.emissionCounter++;
    eventBus.enqueue({ target: boundStream, payload: { emission: createEmission({ value }), source: instance }, type: 'emission' });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Pass the emission forward without modification
  };

  const operator = createOperator(handle);
  operator.name = 'endWith';
  operator.init = init;
  return operator;
};
