import { createSubject, Subject } from '../../lib';
import { createOperator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';

export const iif = (
  condition: (emission: Emission) => boolean,
  trueStream: Subscribable,
  falseStream: Subscribable
) => {
  let output: Subject = createSubject();
  let currentStream: Subscribable | null = null;

  let hasStartedTrueStream = false;
  let hasStartedFalseStream = false;

  const handleInnerEmission = async ({ emission, source }: { emission: Emission, source: Subscribable }) => {
    if (currentStream === source) {
      await output.next(emission.value);
    }
  };

  const finalize = async () => {
    trueStream.onEmission.remove(handleInnerEmission);
    falseStream.onEmission.remove(handleInnerEmission);
    await output.complete();
  };

  trueStream.onEmission.chain(handleInnerEmission);
  falseStream.onEmission.chain(handleInnerEmission);

  const finalizePromise = Promise.all([
    trueStream.awaitCompletion(),
    falseStream.awaitCompletion()
  ]).then(() => finalize());

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    const selectedStream = condition(emission) ? trueStream : falseStream;

    if (currentStream !== selectedStream) {
      currentStream = selectedStream;
    }

    if (!hasStartedTrueStream) {
      trueStream.subscribe();
      hasStartedTrueStream = true;
    }

    if (!hasStartedFalseStream) {
      falseStream.subscribe();
      hasStartedFalseStream = true;
    }

    emission.isPhantom = true;
    return emission;
  };

  const operator = createOperator(handle) as any;
  operator.name = 'iif';
  operator.stream = output;
  return operator;
};
