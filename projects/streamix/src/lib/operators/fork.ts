import { eventBus } from './../streams/bus';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { Counter, counter } from '../utils';
import { createSubject } from '../streams';
import { Subscription } from '../abstractions';


export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T) => boolean; handler: () => Subscribable<R> }>
): Operator => {
  let innerStream: Subscribable | null = null;
  let emissionQueue: Emission[] = [];
  let pendingEmissions: number = 0;
  const executionCounter: Counter = counter(0);
  let isFinalizing: boolean = false;
  let inputStream!: Subscribable | undefined;
  let subscription: Subscription | undefined;
  const outputStream = createSubject();

  const init = (stream: Subscribable) => {
    inputStream = stream;
    inputStream.onStop.once(() => queueMicrotask(() => executionCounter.waitFor(pendingEmissions).then(finalize)));
    outputStream.onStop.once(finalize);
  };

  const handle = async (emission: Emission, stream: Subscribable) => {
    emissionQueue.push(emission);
    pendingEmissions++;

    if(!innerStream) {
      await processQueue();
    }

    emission.phantom = true;
    return emission;
  };

  const processQueue = async (): Promise<void> => {
    while (emissionQueue.length > 0 && !isFinalizing) {
      const nextEmission = emissionQueue.shift();
      if (nextEmission) {
        await processEmission(nextEmission);
      }
    }
  };

  const processEmission = async (emission: Emission): Promise<void> => {
    // Find the matching case based on the selector
    const matchedCase = options.find(({ on }) => on(emission.value));

    if (matchedCase) {
      innerStream = matchedCase.handler(); // Use the selected stream

      if (innerStream) {
        // Immediately set up listeners on the new inner stream
        innerStream.onError.once(({ error }: any) => handleStreamError(emission, error));

        innerStream.onStop.once(() => completeInnerStream(subscription!));

        subscription = innerStream.subscribe((value) => handleInnerEmission(value));
      }
    } else {
      // If no case matches, emit an error
      await handleStreamError(emission, `No handler found for value: ${emission.value}`);
    }
  };

  const handleInnerEmission = (value: any) => {
    outputStream.next(value); // Emit the inner emission
  };

  const completeInnerStream = async (subscription: Subscription) => {
    subscription?.unsubscribe();
    await processQueue();
    executionCounter.increment();
  };

  const handleStreamError = (emission: Emission, error: any) => {
    emission.error = error;
    emission.failed = true;
    eventBus.enqueue({ target: outputStream, payload: { error }, type: 'error'});
    stopStreams(innerStream, outputStream);
    executionCounter.increment();
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    await stopStreams(innerStream, inputStream, outputStream);
    innerStream = null;
  };

  const stopStreams = async (...streams: (Subscribable | null | undefined)[]) => {
    streams.filter(stream => stream && stream.isRunning).forEach(stream => { stream!.isAutoComplete = true; });
  };

  const operator = createOperator(handle) as any;
  operator.name = 'concatMap';
  operator.init = init;
  operator.stream = outputStream;

  return operator;
};
