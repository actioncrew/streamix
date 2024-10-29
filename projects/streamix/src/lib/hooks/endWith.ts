import { Emission, Subscribable, Stream, createOperator, Chunk, Operator } from '../abstractions';

export const endWith = (value: any) => {
  let chunk: Chunk;

  const init = function(this: Operator, stream: Chunk) {
    chunk = stream;
    chunk.onComplete.chain(() => callback(this)); // Trigger the callback on stream completion
  };

  const callback = async (instance: Operator): Promise<void> => {
    // Emit the specified value when the stream completes
    return chunk.emit({ emission: { value }, source: instance });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Pass the emission forward without modification
  };

  const operator = createOperator(handle);
  operator.name = 'endWith';
  operator.init = init;
  return operator;
};
