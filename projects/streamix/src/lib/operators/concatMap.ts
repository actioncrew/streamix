import { createOperator, Emission, eventBus, flags, internals, Operator, Subscribable, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const concatMap = (project: (value: any) => Subscribable): Operator => {
  let currentInnerStream: Subscribable | null = null;
  let emissionQueue: Emission[] = [];
  let processingChain = Promise.resolve();
  const executionCounter: Counter = counter(0);
  let isFinalizing: boolean = false;
  let input!: Subscribable | undefined;
  let subscription: Subscription | undefined;
  const output = createSubject();

  const init = (stream: Subscribable) => {
    input = stream;

    if (input === EMPTY) {
      // If the input stream is EMPTY, complete immediately
      output[flags].isAutoComplete = true;
      return;
    }

    input.emitter.once('finalize', () => queueMicrotask(() => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output.emitter.once('finalize', finalize);
  };

  const handle = (emission: Emission) => {
    emissionQueue.push(emission);

    if(!currentInnerStream) {
      queueMicrotask(processQueue);
    }

    emission.pending = true;
    return emission;
  };

  const processQueue = (): Promise<void> => {
    // Ensure the chain processes emissions sequentially
    processingChain = processingChain.then(async () => {
      while (emissionQueue.length > 0 && !isFinalizing) {
        const nextEmission = emissionQueue.shift(); // Dequeue next emission
        if (nextEmission) {
          await processEmission(nextEmission); // Process it sequentially
        }
      }
    });

    return processingChain;
  };

  const processEmission = async (emission: Emission): Promise<void> => {
    const [error, currentInnerStream] = await catchAny(() => project(emission.value));

    if (error) {
      // Handle errors in the projection function
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      executionCounter.increment();
      delete emission.pending;
      emission.phantom = true;
      return;
    }

    if (currentInnerStream) {
      return new Promise<void>((resolve) => {
        subscription = currentInnerStream!.subscribe({
          next: (value) => {
            handleInnerEmission(emission, value);
          },
          error: (err) => {
            handleStreamError(emission, err);
            resolve(); // Continue the chain even on error
          },
          complete: () => {
            completeInnerStream(emission, subscription!);
            resolve(); // Resolve when complete
          },
        });
      });
    } else {
      return Promise.resolve();
    }
  };

  const handleInnerEmission = (emission: Emission, value: any) => {
    if (!output[internals].shouldComplete()) {
      emission.link(output.next(value));
    }
  };

  const completeInnerStream = async (emission: Emission, subscription: Subscription) => {
    subscription?.unsubscribe();
    executionCounter.increment();
    emission.finalize();
    await processQueue();
  };

  const handleStreamError = (emission: Emission, error: any) => {
    eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
    emission.phantom = true;
    finalize();
  };

  const finalize = () => {
    if (isFinalizing) return;
    isFinalizing = true;

    stopStreams(currentInnerStream, input, output);
    currentInnerStream = null;
  };

  const stopStreams = (...streams: (Subscribable | null | undefined)[]) => {
    streams.filter(stream => stream && stream[flags].isRunning).forEach(stream => { stream![flags].isAutoComplete = true; });
  };

  const operator = createOperator(handle) as any;
  operator.name = 'concatMap';
  operator.init = init;
  operator.stream = output;

  return operator;
};
