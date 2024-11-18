import { eventBus } from './../streams/bus';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { Counter, counter } from '../utils';
import { createSubject } from '../streams';
import { Subscription } from '../abstractions';

export const concatMap = (project: (value: any) => Subscribable): Operator => {
  let currentInnerStream: Subscribable | null = null;
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

    if(!currentInnerStream) {
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
    currentInnerStream = project(emission.value);

    if (currentInnerStream) {
      // Immediately set up listeners on the new inner stream
      currentInnerStream.onError.once(({ error }: any) => handleStreamError(emission, error));

      currentInnerStream.onStop.once(() => completeInnerStream(subscription!));

      subscription = currentInnerStream.subscribe((value) => handleInnerEmission(value));
    }
  };

  const handleInnerEmission = (value: any) => {
    outputStream.next(value);
  };

  const completeInnerStream = async (subscription: Subscription) => {
    subscription?.unsubscribe();
    await processQueue();
    executionCounter.increment();
  };

  const handleStreamError = (emission: Emission, error: any) => {
    eventBus.enqueue({ target: outputStream, payload: { error }, type: 'error'});
    stopStreams(currentInnerStream, outputStream);
    executionCounter.increment();
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    await stopStreams(currentInnerStream, inputStream, outputStream);
    currentInnerStream = null;
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
