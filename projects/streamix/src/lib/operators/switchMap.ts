import { counter, createSubject, Subject } from '../../lib';
import { Emission, Subscribable, Subscription, createOperator } from '../abstractions';
import { CounterType } from '../../lib';

// The switchMap operator implemented functionally, closely mirroring the class-based implementation
export const switchMap = <T = any, R = T>(project: (value: T) => Subscribable<R>) => {
  let activeInnerStream: Subscribable<R> | null = null;
  let isFinalizing = false;
  let emissionNumber: number = 0;
  let executionNumber: CounterType = counter(0);
  let subscription: Subscription | undefined;

  const output = createSubject<R>();

  const init = (stream: Subscribable<T>) => {
    stream.onStop.once(async () => {
      await executionNumber.waitFor(emissionNumber);
      await finalize();
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

    try {
      const value = emission.value as T;  // Explicitly type emission.value as T (number in your case)
      const newInnerStream = project(value);

      // Ensure active inner stream is stopped before starting a new one
      if (newInnerStream !== activeInnerStream) {
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
    } catch (error: any) {
      if (!subscribed) {
        executionNumber.increment();
      }
      emission.isFailed = true;
      emission.error = error;
      return emission;
    }
  };

  // Create the operator with type-safe extension
  const operator = createOperator(handle);

  // Return the operator with the necessary stream and initialization
  return Object.assign(operator, {
    name: 'switchMap',
    init,
    stream: output,
  });
};
