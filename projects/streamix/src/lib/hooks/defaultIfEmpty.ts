import { Emission, Subscribable, Stream, createOperator, Operator, createEmission, hooks } from '../abstractions';
import { eventBus } from '../abstractions';

export const defaultIfEmpty = (defaultValue: any): Operator => {
  let boundStream: Stream;
  let hasEmitted = false;

  const init = (stream: Stream) => {
    boundStream = stream;
    boundStream[hooks].onComplete.chain(callback); // Chain the callback to be triggered on stream completion
  };

  const callback = async (): Promise<void> => {
    if (!hasEmitted) {
      // If nothing has been emitted, emit the default value
      let emission = createEmission({ value: defaultValue });
      eventBus.enqueue({ target: boundStream, payload: { emission, source: operator }, type: 'emission' });
    }
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Mark the emission if it's not a phantom or failed
    if (!emission.phantom && !emission.failed) {
      hasEmitted = true;
    }
    return emission; // Pass the emission forward
  };

  const operator = createOperator(handle);
  operator.name = 'defaultIfEmpty';
  operator.init = init;
  return operator;
};
