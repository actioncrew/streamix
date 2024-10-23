import { Emission, Subscribable, Stream, createOperator } from '../abstractions';

export const startWith = (value: any) => {
  let boundStream: Stream;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream.onStart.chain(callback); // Trigger the callback when the stream starts
  };

  const callback = async (): Promise<void> => {
    // Emit the provided initial value when the stream starts
    await boundStream.onEmission.process({ emission: { value }, source: boundStream });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Simply pass the emission without modification
  };

  const operator = createOperator(handle);
  operator.name = 'startWith';
  operator.init = init;
  return operator;
};
