import { Subscribable, Emission, createOperator } from '../abstractions';
import { Subject, counter, CounterType, createSubject } from '../../lib';

export const switchMap = <T, R>(project: (value: T) => Subscribable<R>) => {
  let activeInnerStream: Subscribable<R> | null = null;
  let isFinalizing = false;
  let emissionNumber: number = 0;
  let executionNumber: CounterType = counter(0);

  const output = createSubject<R>();

  const init = (stream: Subscribable<T>) => {
    stream.onStop.once(() => {
      executionNumber.waitFor(emissionNumber).then(finalize);
    });
    output.onStop.once(finalize);
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    await stopInnerStream();
    if (!output.isStopped) {
      await output.complete();
    }
  };

  const stopInnerStream = async () => {
    if (activeInnerStream) {
      await activeInnerStream.complete();
      activeInnerStream.onEmission.remove(handleInnerEmission);

      activeInnerStream = null;
    }
  };

  const handleInnerEmission = async ({ emission: innerEmission }: { emission: Emission }) => {
    await output.next(innerEmission.value);
  };

  const handle = async (emission: Emission, stream: Subscribable<T>): Promise<Emission> => {
    emissionNumber++;
    let subscribed = false;

    // Create a new inner stream using the project function
    try {
      // Create a new inner stream using the project function
      const newInnerStream = project(emission.value);
      if (newInnerStream !== activeInnerStream) {
        // Stop the current inner stream before starting the new one
        await stopInnerStream();
      }

      activeInnerStream = newInnerStream;

      // Chain inner emissions and handle errors
      activeInnerStream.onEmission.chain(handleInnerEmission);

      activeInnerStream?.onStop.once(() => {
        executionNumber.increment();
      });

      // Subscribe to start the new inner stream
      activeInnerStream.subscribe();
      subscribed = true;

      // Mark the original emission as phantom to avoid duplicating it
      emission.isPhantom = true;
      return emission;
    } catch(error: any) {
      if (!subscribed) { executionNumber.increment(); }
      emission.isFailed = true;
      emission.error = error;
      return emission;
    }
  };

  // Create the operator with type-safe extension
  const operator = createOperator(handle);
  return Object.assign(operator, {
    name: 'switchMap',
    init,
    stream: output,
  });
};
