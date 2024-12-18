import { Emission, Subscribable, Stream, createOperator, Operator, hooks, Chunk } from '../abstractions';

export const catchError = (handler: (error?: any) => void | Promise<void>): Operator => {
  let boundStream: Chunk;

  const init = (chunk: Chunk) => {
    boundStream = chunk;
    boundStream[hooks].onError.chain(callback); // Chain the error handling callback to the stream
  };

  const callback = async ({ error }: any): Promise<void> => {
    return handler(error); // Call the provided handler when an error occurs
  };

  const handle = (emission: Emission): Emission => {
    return emission; // Pass the emission as is
  };

  const operator = createOperator(handle);
  operator.name = 'catchError';
  operator.init = init;
  return operator;
};
