import { Emission, Subscribable, Stream, createOperator, Chunk, Operator } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any) => {
  let chunk: Chunk;
  let accumulatedValue = seed;

  const init = function(this: Operator, stream: Chunk) {
    chunk = stream;
    chunk.onComplete.chain(() => callback(this)); // Trigger the callback when the stream completes
  };

  const callback = async (instance: Operator): Promise<void> => {
    // Emit the accumulated value once the stream completes
    await chunk.emit({ emission: { value: accumulatedValue }, source: instance });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Accumulate the value using the provided accumulator function
    accumulatedValue = accumulator(accumulatedValue, emission.value!);
    emission.isPhantom = true; // Mark the emission as phantom
    return emission; // Return the emission
  };

  const operator = createOperator(handle);
  operator.name = 'reduce';
  operator.init = init;
  return operator;
};
