import { Emission, Subscribable, Stream, createOperator, Operator } from '../abstractions';
import { eventBus } from '../streams';

export const defaultIfEmpty = (defaultValue: any): Operator => {
  let boundStream: Stream;
  let hasEmitted = false;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream.onComplete.chain(callback); // Chain the callback to be triggered on stream completion
  };

  const callback = (): void => {
    if (!hasEmitted) {
      // If nothing has been emitted, emit the default value
      eventBus.enqueue({ target: boundStream, payload: { emission: { value: defaultValue }, source: this }, type: 'emission' });
    }
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Mark the emission if it's not a phantom or failed
    if (!emission.isPhantom && !emission.isFailed) {
      hasEmitted = true;
    }
    return emission; // Pass the emission forward
  };

  const operator = createOperator(handle);
  operator.name = 'defaultIfEmpty';
  operator.init = init;
  return operator;
};
