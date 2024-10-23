import { createOperator, Emission, Stream, Subscribable } from '../abstractions';
import { asyncValue } from '../utils';

export const withLatestFrom = (...streams: Subscribable[]) => {
  let latestValues = streams.map(() => asyncValue());
  let handleEmissionFns: Array<(event: { emission: Emission; source: Subscribable }) => void> = [];
  let started = false;

  const handleStreamEmissions = (source: Subscribable, index: number) => {
    const latestValue = latestValues[index];
    const handleEmission = async ({ emission }: { emission: Emission }) => {
      latestValue.set(emission.value);
    };

    source.onEmission.chain(handleEmission);
    handleEmissionFns.push(handleEmission);
  };

  const init = (stream: Stream) => {
    streams.forEach((source, index) => handleStreamEmissions(source, index));

    stream.onStop.once(finalize); // Cleanup on stream termination
  };

  const finalize = () => {
    streams.forEach((source, index) => {
      if (source.isStopped) {
        source.onEmission.remove(handleEmissionFns[index]);
      }
    });

    latestValues = [];
    handleEmissionFns = [];
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    if (!started) {
      started = true;
      streams.forEach(source => source.start());
    }

    if (stream.shouldComplete()) {
      await Promise.all(streams.map(source => source.complete()));
    }

    const latestValuesPromise = Promise.all(latestValues.map(async (value) => await value()));
    const terminationPromises = Promise.race([
      stream.awaitCompletion(),
      ...streams.map(source => source.awaitCompletion()),
    ]);

    await Promise.race([latestValuesPromise, terminationPromises]);

    if (latestValues.every((value) => value.hasValue())) {
      emission.value = [emission.value, ...latestValues.map(value => value.value())];
    } else {
      emission.isFailed = true;
      emission.error = new Error("Some streams are completed without emitting value.");
      finalize();
    }
    return emission;
  };

  const operator = createOperator(handle);
  operator.name = 'withLatestFrom';
  operator.init = init;
  return operator;
};
