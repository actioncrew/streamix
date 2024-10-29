import { Emission, Subscribable, Stream, createOperator, Chunk, Operator } from '../abstractions';

export const defaultIfEmpty = (defaultValue: any) => {
  let chunk: Chunk;
  let hasEmitted = false;

  const init = function (this: Operator, stream: Chunk) {
    chunk = stream;
    chunk.onComplete.chain(() => callback(this)); // Chain the callback to be triggered on stream completion
  };

  const callback = async (instance: Operator): Promise<void> => {
    if (!hasEmitted) {
      // If nothing has been emitted, emit the default value
      return chunk.emit({ emission: { value: defaultValue }, source: instance });
    }
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Mark the emission if it's not a phantom or failed
    if (!emission.isPhantom && !emission.isFailed) {
      hasEmitted = true;
    }
    return emission; // Pass the emission forward
  };

  const operator = createOperator(handle);
  operator.name = 'defaultIfEmpty';
  operator.init = init;
  return operator;
};
