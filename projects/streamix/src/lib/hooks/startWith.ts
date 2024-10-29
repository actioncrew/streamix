import { Emission, Subscribable, Stream, createOperator, Chunk, Operator } from '../abstractions';

export const startWith = (value: any) => {
  let chunk: Chunk;

  const init = function (this: Operator, stream: Chunk) {
    chunk = stream;
    chunk.onStart.chain(() => callback(this)); // Trigger the callback when the stream starts
  };

  const callback = async (instance: Operator): Promise<void> => {
    // Emit the provided initial value when the stream starts
    await chunk.emit({ emission: { value }, source: instance });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Simply pass the emission without modification
  };

  const operator = createOperator(handle);
  operator.name = 'startWith';
  operator.init = init;
  return operator;
};
