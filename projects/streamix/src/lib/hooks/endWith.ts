import { Emission, Subscribable, Stream } from '../abstractions';

export const endWith = (value: any) => {
  let boundStream: Stream;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream.onComplete.chain(callback); // Trigger the callback on stream completion
  };

  const callback = async (): Promise<void> => {
    // Emit the specified value when the stream completes
    return boundStream.onEmission.process({ emission: { value }, source: boundStream });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    return emission; // Pass the emission forward without modification
  };

  return {
    init,
    handle
  };
};
