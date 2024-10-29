import { Chunk, createOperator, Emission, HookOperator, Operator, Stream, Subscribable } from '../abstractions';

export const finalize = (callback: () => void | Promise<void>) => {
  let chunk: Chunk;

  const init = (stream: Chunk) => {
    chunk = stream;
    // Chain the callback to the stream's onStop event
    chunk.onStop.chain(callback);
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Pass the emission through without modification
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'finalize';
  operator.init = init;
  return operator;
};
