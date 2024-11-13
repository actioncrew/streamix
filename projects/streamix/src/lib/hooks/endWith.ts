import { Emission, Subscribable, Stream, createOperator, Operator } from '../abstractions';

export const endWith = (value: any) => {
  let boundStream: Stream;

  const init = function(this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream.onComplete.chain((params: any) => callback(this, params)); // Trigger the callback when the stream starts
  };

  const callback = async (instance: Operator, params?: any): Promise<void> => {
    // Emit the provided initial value when the stream starts
    await boundStream.onEmission.parallel({ emission: { value }, source: instance });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Pass the emission forward without modification
  };

  const operator = createOperator(handle) as Operator;
  operator.name = 'endWith';
  operator.init = init;
  return operator;
};
