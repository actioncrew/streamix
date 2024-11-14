import { eventBus } from './../streams/bus';
import { Emission, Subscribable, Stream, createOperator, Operator } from '../abstractions';

export const startWith = (value: any): Operator => {
  let boundStream: Stream;

  const init = function(this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream.onStart.chain((params: any) => callback(this, params)); // Trigger the callback when the stream starts
  };

  const callback = (instance: Operator, params?: any): void => {
    // Emit the provided initial value when the stream starts
    eventBus.enqueue({ target: boundStream, payload: { emission: { value }, source: instance }, type: 'emission' });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Simply pass the emission without modification
  };

  const operator = createOperator(handle);
  operator.name = 'startWith';
  operator.init = init;
  return operator;
};
