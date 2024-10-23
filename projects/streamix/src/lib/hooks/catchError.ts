import { Emission, Subscribable, Stream } from '../abstractions';

export const catchError = (handler: (error?: any) => void | Promise<void>) => {
  let boundStream: Stream;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream.onError.chain(callback); // Chain the error handling callback to the stream
  };

  const callback = async ({ error }: any): Promise<void> => {
    return handler(error); // Call the provided handler when an error occurs
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Pass the emission as is
  };

  return {
    init,
    handle
  };
};
