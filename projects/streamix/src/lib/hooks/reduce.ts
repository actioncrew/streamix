import { Emission, Subscribable, Stream } from '../abstractions';

export const reduce = (accumulator: (acc: any, value: any) => any, seed: any) => {
  let boundStream: Stream;
  let accumulatedValue = seed;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream.onComplete.chain(callback); // Trigger the callback when the stream completes
  };

  const callback = async (): Promise<void> => {
    // Emit the accumulated value once the stream completes
    await boundStream.onEmission.process({ emission: { value: accumulatedValue }, source: boundStream });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Accumulate the value using the provided accumulator function
    accumulatedValue = accumulator(accumulatedValue, emission.value!);
    emission.isPhantom = true; // Mark the emission as phantom
    return emission; // Return the emission
  };

  return {
    init,
    handle
  };
};
