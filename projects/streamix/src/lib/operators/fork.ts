import { eventBus } from '../abstractions';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { Counter, counter } from '../utils';
import { createSubject } from '../streams';
import { Subscription } from '../abstractions';


export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T) => boolean; handler: () => Subscribable<R> }>
): Operator => {
  let innerStream: Subscribable | null = null;
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

    if(!innerStream) {
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
    // Find the matching case based on the selector
    const matchedCase = options.find(({ on }) => on(emission.value));

    if (matchedCase) {
      innerStream = matchedCase.handler(); // Use the selected stream

      if (innerStream) {
        // Immediately set up listeners on the new inner stream
        innerStream.onError.once(({ error }: any) => handleStreamError(emission, error));

        innerStream.onStop.once(() => completeInnerStream(emission, subscription!));

        subscription = innerStream.subscribe((value) => handleInnerEmission(value));
      }
    } else {
      // If no case matches, emit an error
      await handleStreamError(emission, `No handler found for value: ${emission.value}`);
    }
  };

  const handleInnerEmission = (value: any) => {
    output.next(value); // Emit the inner emission
  };

  const completeInnerStream = async (emission: Emission, subscription: Subscription) => {
    subscription?.unsubscribe();
    emission.finalize();
    await processQueue();
    executionCounter.increment();
  };

  const handleStreamError = (emission: Emission, error: any) => {
    emission.error = error;
    emission.failed = true;
    eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
    stopStreams(innerStream, output);
    executionCounter.increment();
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    await stopStreams(innerStream, input, output);
    innerStream = null;
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
