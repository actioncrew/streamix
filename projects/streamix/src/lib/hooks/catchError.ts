import { Emission, Operator, Stream, createOperator, hooks } from '../abstractions';

export const catchError = (handler: (error?: any) => void | Promise<void>): Operator => {
  let boundStream: Stream;

  const init = (stream: Stream) => {
    boundStream = stream;
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
