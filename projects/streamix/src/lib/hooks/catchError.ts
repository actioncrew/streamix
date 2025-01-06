import { Emission, Operator, Stream, createOperator } from '../abstractions';

export const catchError = (handler: (error?: any) => void | Promise<void>): Operator => {
  let boundStream: Stream;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream.emitter.on('error', callback); // Chain the error handling callback to the stream
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
