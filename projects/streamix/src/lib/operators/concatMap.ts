import { createEmission, createOperator, Emission, eventBus, flags, hooks, internals, StreamOperator, Subscribable, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const concatMap = (project: (value: any) => Subscribable): StreamOperator => {
  return (inputStream) => {
    let currentInnerStream: Subscribable | null = null;
    let emissionQueue: Emission[] = [];
    let processingChain = Promise.resolve();
    const executionCounter: Counter = counter(0);
    let isFinalizing = false;
    let subscription: Subscription | undefined;
    const output = createSubject();

    const init = () => {
      if (inputStream === EMPTY) {
        output[flags].isAutoComplete = true;
        return;
      }

      // Subscribe to the inputStream
      subscription = inputStream.subscribe({
        next: (value) => {
          if (!output[internals].shouldComplete()) {
            handleEmission(createEmission({ value }));
          }
        },
        error: (err) => {
          eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
        },
        complete: () => {
          queueMicrotask(() =>
            executionCounter.waitFor(inputStream.emissionCounter).then(finalize)
          );
        },
      });

      output[hooks].finalize.once(finalize);
    };

    const handleEmission = (emission: Emission) => {
      emissionQueue.push(emission);

      if (!currentInnerStream) {
        queueMicrotask(processQueue);
      }

      emission.pending = true;
      return emission;
    };

    const processQueue = (): Promise<void> => {
      processingChain = processingChain.then(async () => {
        while (emissionQueue.length > 0 && !isFinalizing) {
          const nextEmission = emissionQueue.shift();
          if (nextEmission) {
            await processEmission(nextEmission);
          }
        }
      });
      return processingChain;
    };

    const processEmission = async (emission: Emission): Promise<void> => {
      const [error, innerStream] = await catchAny(() => project(emission.value));

      if (error) {
        eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
        emission.phantom = true;
        finalize();
        return;
      }

      currentInnerStream = innerStream;

      if (currentInnerStream) {
        return new Promise<void>((resolve) => {
          subscription = currentInnerStream!.subscribe({
            next: (value) => {
              if (!output[internals].shouldComplete()) {
                emission.link(output.next(value));
              }
            },
            error: (err) => {
              eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
              resolve();
            },
            complete: () => {
              finalizeInnerStream(emission);
              resolve();
            },
          });
        });
      }
    };

    const finalizeInnerStream = (emission: Emission) => {
      if (subscription) {
        subscription.unsubscribe();
      }
      currentInnerStream = null;
      executionCounter.increment();
      emission.finalize();
      queueMicrotask(processQueue);
    };

    const finalize = () => {
      if (isFinalizing) return;
      isFinalizing = true;

      [currentInnerStream, inputStream, output].forEach((stream) => {
        if (stream && stream[flags]?.isRunning) {
          stream[flags].isAutoComplete = true;
        }
      });

      currentInnerStream = null;
    };

    const operator = createOperator(handleEmission);
    operator.init = init;
    operator.name = 'concatMap';

    init();
    return output;
  };
};
