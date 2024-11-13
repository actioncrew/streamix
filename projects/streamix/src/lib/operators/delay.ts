import { Emission, Subscribable, Stream, createOperator, Operator } from '../abstractions';

export const delay = (delayTime: number) => {
  let applyDelay: (emission: Emission) => Promise<Emission>;
  let completionPromise: Promise<void>;

  const init = (stream: Stream) => {
    applyDelay = (emission: Emission) => new Promise<Emission>((resolve) => {
      const timeout = setTimeout(() => resolve(emission), delayTime);

      // Handle stream completion to clear the timeout
      completionPromise = stream.awaitCompletion().then(() => {
        emission.isPhantom = true; // Mark emission as phantom when stream completes
        clearTimeout(timeout);
        resolve(emission);
      });
    });
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    await applyDelay(emission); // Apply the delay to the emission
    return emission;
  };

  const operator = createOperator(handle) as Operator;
  operator.name = 'delay';
  operator.init = init;
  return operator;
};
