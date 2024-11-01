import { createSubject, Subject } from '../../lib';
import { createOperator, Emission, Stream, Subscribable } from '../abstractions';

export const switchMap = <T, R>(project: (value: T) => Subscribable<R>) => {
  let activeInnerStream: Subscribable<R> | null = null;
  let isFinalizing = false;
  let previousResolver: ((emission: Emission) => void) | null = null;
  let previousEmission: Emission | null = null;

  const output = createSubject<R>();

  const init = (stream: Stream<T>) => {
    stream.onStop.once(() => finalize());
    output.onStop.once(() => finalize());
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
      // Safely remove the emission handler
      activeInnerStream.onEmission.remove(handleInnerEmission);

      // Complete the inner stream if it's not already stopped
      if (!activeInnerStream.isStopped) {
        await activeInnerStream.complete();
      }

      activeInnerStream = null;
    }
  };

  const handle = async (emission: Emission, stream: Subscribable<T>): Promise<Emission> => {
    if (stream.shouldComplete()) {
      emission.isPhantom = true;
      await stopInnerStream();
      return emission;
    }

    return processEmission(emission, output);
  };

  const handleInnerEmission = async ({ emission: innerEmission }: { emission: Emission }) => {
    // Only propagate non-phantom emissions
    if (!output.shouldComplete()) {
      await output.next(innerEmission.value);
    }
  };

  const processEmission = async (emission: Emission, stream: Subject<R>): Promise<Emission> => {
    const newInnerStream = project(emission.value);

    // Resolve previous promise with the previous emission
    if (previousResolver && previousEmission) {
      previousResolver(previousEmission!);
      previousResolver = null;
    }

    // If the new inner stream is different from the active one
    if (activeInnerStream !== newInnerStream) {
      // Stop the previous inner stream
      await stopInnerStream();

      // Set the new active inner stream
      activeInnerStream = newInnerStream;

      // Chain the inner emission handler
      activeInnerStream.onEmission.chain(handleInnerEmission);

      // Set up error handling
      activeInnerStream.onError.once((error: any) => {
        emission.error = error;
        emission.isFailed = true;
        removeInnerStream(activeInnerStream!);
        previousResolver && previousResolver(emission);
        previousResolver = null;
      });

      // Subscribe to start the inner stream
      activeInnerStream.subscribe();
    } else {
      previousResolver && previousResolver(emission);
      previousResolver = null;
    }

    // Mark the original emission as phantom
    emission.isPhantom = true;
    previousEmission = emission as Emission;

    // Return a promise that resolves when the inner stream stops
    return new Promise<Emission>((resolve) => {
      previousResolver = resolve;
      activeInnerStream!.onStop.once(() => {
        removeInnerStream(activeInnerStream!);
        previousResolver && previousResolver(emission);
        previousResolver = null;
      });
    });
  };

  const removeInnerStream = (innerStream: Subscribable<R>) => {
    if (activeInnerStream === innerStream) {
      // Safely remove the emission handler
      activeInnerStream.onEmission.remove(handleInnerEmission);
      activeInnerStream = null;
    }
  };

  // Create the operator with type-safe extension
  const operator = createOperator(handle);
  return Object.assign(operator, {
    name: 'switchMap',
    init,
    stream: output
  });
};
