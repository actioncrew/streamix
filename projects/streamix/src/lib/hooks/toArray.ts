import { BusEvent, createEmission, createOperator, Emission, hooks, Operator, Stream } from '../abstractions';

export const toArray = (): Operator => {
  let boundStream: Stream;
  let accumulatedArray: any[] = []; // Array to store all emissions

  const init = function (this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream[hooks].onComplete.once(() => callback(this)); // Trigger the callback when the stream completes
  };

  const callback = (instance: Operator): (() => BusEvent) | void => {
    // Emit the accumulated array once the stream completes
    return () => ({
      target: boundStream,
      payload: {
        emission: createEmission({ value: accumulatedArray }),
        source: instance,
      },
      type: 'emission',
    });
  };

  const handle = (emission: Emission): Emission => {
    // Collect each emission value into the array
    accumulatedArray.push(emission.value!);
    emission.phantom = true; // Mark the emission as phantom
    return emission; // Return the emission
  };

  const operator = createOperator(handle);
  operator.name = 'toArray';
  operator.init = init;
  return operator;
};
