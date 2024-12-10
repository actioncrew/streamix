import { eventBus, flags, hooks, internals } from '../abstractions';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { catchAny, Counter, counter } from '../utils';
import { createSubject, EMPTY } from '../streams';
import { Subscription } from '../abstractions';


export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T) => boolean; handler: () => Subscribable<R> }>
): Operator => {
  let innerStream: Subscribable | null = null;
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

    input[hooks].finalize.once(() => queueMicrotask(() => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output[hooks].finalize.once(finalize);
  };

  const handle = (emission: Emission) => {
    emissionQueue.push(emission);

    if(!innerStream) {
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
    // Find the matching case based on the selector
    const matchedCase = options.find(({ on }) => on(emission.value));

    if (matchedCase) {
      const [error, innerStream] = await catchAny(() => matchedCase.handler());

      if (error) {
        // Handle errors in the projection function
        eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
        executionCounter.increment();
        delete emission.pending;
        emission.phantom = true;
        return;
      }

      return new Promise<void>((resolve) => {
        subscription = innerStream!.subscribe({
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
      // If no case matches, emit an error
      executionCounter.increment();
      emission.finalize();
      handleStreamError(emission, new Error(`No handler found for value: ${emission.value}`));
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
    emission.finalize();
    await processQueue();
    executionCounter.increment();
  };

  const handleStreamError = (emission: Emission, error: any) => {
    eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
    emission.failed = true;
    emission.error = error;
    finalize();
  };

  const finalize = () => {
    if (isFinalizing) return;
    isFinalizing = true;

    stopStreams(innerStream, input, output);
    innerStream = null;
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
