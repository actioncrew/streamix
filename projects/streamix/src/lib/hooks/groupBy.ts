import { createOperator, Operator, Emission, BusEvent, createEmission, Stream } from '../abstractions';
import { hooks } from '../abstractions';

export const groupBy = <T = any>(keyFn: (value: T) => string | number): Operator => {
  const partitions = new Map<string | number, T[]>(); // Track partitioned values
  let boundStream: Stream;

  const init = function (this: Operator, stream: Stream) {
    boundStream = stream;
    boundStream[hooks].onComplete.once(() => callback(this)); // Register the callback on stream completion
  };

  const callback = (instance: Operator): (() => BusEvent) | void => {
    // Emit the result once all partitions have been completed
    return () => ({ target: boundStream, payload: { emission: createEmission({ value: partitions }), source: instance }, type: 'emission' });
  };

  const handle = (emission: Emission) => {
    const key = keyFn(emission.value); // Calculate the partition key based on the value

    // If it's a new partition, add it to the map
    if (!partitions.has(key)) {
      partitions.set(key, []);
    }

    const partition = partitions.get(key)!;

    // Add the emission value to the partition's values array
    partition.push(emission.value);

    // Mark the emission as phantom to prevent it from being processed immediately
    emission.phantom = true;

    return emission; // Return the modified emission
  };

  // Create the operator
  const operator = createOperator(handle) as any;
  operator.name = 'partitionBy';
  operator.init = init;

  return operator;
};
