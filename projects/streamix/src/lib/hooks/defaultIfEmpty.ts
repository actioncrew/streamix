import { BusEvent, Emission, Operator, Stream, createEmission, createOperator } from '../abstractions';

export const defaultIfEmpty = (defaultValue: any): Operator => {
  let boundStream: Stream;
  let hasEmitted = false;

  const init = function (this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream.emitter.once('complete', callback); // Chain the callback to be triggered on stream completion
  };

  const callback = function (this: Operator): (() => BusEvent) | void {
    if (!hasEmitted) {
      // If nothing has been emitted, emit the default value
      let emission = createEmission({ value: defaultValue });
      return () => ({ target: boundStream, payload: { emission, source: this }, type: 'emission' });
    }
  };

  const handle = function (this: Operator, emission: Emission): Emission {
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
