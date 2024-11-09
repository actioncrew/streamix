import { createSubject, Subject } from '../../lib';
import { createOperator, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';

export const iif = (
  condition: () => boolean, // Evaluate condition once at initialization
  trueStream: Subscribable,
  falseStream: Subscribable
) => {
  let output: Subject = createSubject();
  let selectedStream: Subscribable | null = null;
  let hasSubscribed = false;

  // Finalize function to clean up
  const finalize = async () => {
    selectedStream?.onEmission.remove(handleInnerEmission);
    await output.complete();
  };

  // Emission handler to forward emissions from the selected stream
  const handleInnerEmission = async ({ emission }: { emission: Emission }) => {
    await output.next(emission.value);
  };

  // Determine the stream based on the condition only once at initialization
  selectedStream = condition() ? trueStream : falseStream;

  // Chain emissions and errors from the selected stream
  selectedStream.onEmission.chain(handleInnerEmission);
  selectedStream.onStop.once(() => finalize());

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    // Subscribe to the selected stream only once
    if (!hasSubscribed) {
      selectedStream?.subscribe();
      hasSubscribed = true;
    }

    return emission; // Return the emission unmodified, as we only use it to trigger the operator
  };

  const operator = createOperator(handle) as any;
  operator.name = 'iif';
  operator.stream = output;
  return operator;
};
