import { Emission, Subscribable, Stream, createOperator, Chunk } from '../abstractions';

export const catchError = (handler: (error?: any) => void | Promise<void>) => {
  let chunk: Chunk;

  const init = (stream: Chunk) => {
    chunk = stream;
    chunk.onError.chain(callback); // Chain the error handling callback to the stream
  };

  const callback = async ({ error }: any): Promise<void> => {
    return handler(error); // Call the provided handler when an error occurs
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Pass the emission as is
  };

  const operator = createOperator(handle);
  operator.name = 'catchError';
  operator.init = init;
  return operator;
};
