import { eventBus } from '../abstractions';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { Counter, counter } from '../utils';
import { createSubject } from '../streams';
import { Subscription } from '../abstractions';
import { createEmission } from '../abstractions';

export const concatMap = (project: (value: any) => Subscribable): Operator => {
  let currentInnerStream: Subscribable | null = null;
  let emissionQueue: Emission[] = [];
  const executionCounter: Counter = counter(0);
  let isFinalizing: boolean = false;
  let input!: Subscribable | undefined;
  let subscription: Subscription | undefined;
  const output = createSubject();

  const init = (stream: Subscribable) => {
    input = stream;
    input.onStop.once(() => queueMicrotask(() => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output.onStop.once(finalize);
  };

  const handle = async (emission: Emission, stream: Subscribable) => {
    emissionQueue.push(emission);

    if(!currentInnerStream) {
      await processQueue();
    }

    emission.pending = true;
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

      currentInnerStream.onStop.once(() => completeInnerStream(emission, subscription!));

      subscription = currentInnerStream.subscribe((value) => emission.link(handleInnerEmission(value)));
    }
  };

  const handleInnerEmission = (value: any): Emission => {
    return output.next(value);
  };

  const completeInnerStream = async (emission: Emission, subscription: Subscription) => {
    executionCounter.increment();
    emission.finalize();
    subscription?.unsubscribe();
    await processQueue();
  };

  const handleStreamError = (emission: Emission, error: any) => {
    eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
    stopStreams(currentInnerStream, output);
    executionCounter.increment();
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    await stopStreams(currentInnerStream, input, output);
    currentInnerStream = null;
  };

  const stopStreams = async (...streams: (Subscribable | null | undefined)[]) => {
    streams.filter(stream => stream && stream.isRunning).forEach(stream => { stream!.isAutoComplete = true; });
  };

  const operator = createOperator(handle) as any;
  operator.name = 'concatMap';
  operator.init = init;
  operator.stream = output;

  return operator;
};
