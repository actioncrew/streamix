import { createSubject, eventBus, Subject } from '../streams';
import { createOperator, Emission, Operator, Stream, Subscribable, Subscription } from '../abstractions';

export const switchMap = <T = any, R = T>(project: (value: T) => Subscribable<R>): Operator => {
  let activeInnerStream: Subscribable<R> | null = null;
  let isFinalizing = false;
  let subscription: Subscription | undefined;

  const output = createSubject<R>();

  const init = (stream: Stream<T>) => {
    stream.onStop.once(() => finalize());
    output.onStop.once(() => finalize());
  };

  const finalize = () => {
    if (isFinalizing) return;
    isFinalizing = true;

    stopInnerStream();
    if (!output.isStopped) {
      output.isAutoComplete = true;
    }
  };

  const stopInnerStream = () => {
    if (activeInnerStream) {
      subscription?.unsubscribe();
      activeInnerStream = null;
    }
  };

  const handle = async (emission: Emission, stream: Subscribable<T>): Promise<Emission> => {
    return processEmission(emission, output);
  };

  const handleInnerEmission = (value: any) => {
    output.next(value);
  };

  const processEmission = async (emission: Emission, stream: Subject<R>): Promise<Emission> => {
    const newInnerStream = project(emission.value);

    // If the new inner stream is different from the active one
    if (activeInnerStream !== newInnerStream) {
      // Stop the previous inner stream
      stopInnerStream();

      // Set the new active inner stream
      activeInnerStream = newInnerStream;

      // Set up error handling
      activeInnerStream.onError.once((error: any) => {
        eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
        removeInnerStream(activeInnerStream!);
      });

      activeInnerStream.onStop.once(() => {
        removeInnerStream(activeInnerStream!);
      })

      // Subscribe to start the inner stream
      subscription = activeInnerStream.subscribe(value => handleInnerEmission(value));
    }

    // Mark the original emission as phantom
    emission.isPhantom = true;
    return emission;
  };

  const removeInnerStream = (innerStream: Subscribable<R>) => {
    if (activeInnerStream === innerStream) {
      // Safely remove the emission handler
      subscription?.unsubscribe();
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
