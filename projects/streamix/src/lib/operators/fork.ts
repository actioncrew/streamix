import { createEmission, createStreamOperator, Emission, eventBus, flags, internals, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T) => boolean; handler: () => Stream<R> }>
): StreamOperator => {
  const operator = (input: Stream) => {
    let currentInnerStream: Stream | null = null;
    let emissionQueue: Emission[] = [];
    let processingChain = Promise.resolve();
    const executionCounter: Counter = counter(0);
    let isFinalizing = false;
    let subscription: Subscription | undefined;
    const output = createSubject();

    const init = () => {
      if (input === EMPTY) {
        output[flags].isAutoComplete = true;
        return;
      }

      // Subscribe to the inputStream
      subscription = input.subscribe({
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
            executionCounter.waitFor(input.emissionCounter).then(finalize)
          );
        },
      });

      output.emitter.once('finalize', finalize);
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
      const matchedCase = options.find(({ on }) => on(emission.value));

      if (matchedCase) {
        const [error, innerStream] = await catchAny(() => matchedCase.handler());

        if (error) {
          eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
          emission.phantom = true;
          finalize();
          return;
        }

        currentInnerStream = innerStream;

        return new Promise<void>((resolve) => {
          subscription = currentInnerStream!.subscribe({
            next: (value) => {
              if (!output[internals].shouldComplete()) {
                emission.link(output.next(value));
              }
            },
            error: (err) => {
              handleStreamError(emission, err);
              resolve();
            },
            complete: () => {
              finalizeInnerStream(emission);
              resolve();
            },
          });
        });
      } else {
        executionCounter.increment();
        emission.finalize();
        handleStreamError(emission, new Error(`No handler found for value: ${emission.value}`));
        return Promise.resolve();
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

    const handleStreamError = (emission: Emission, error: any) => {
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      emission.error = error;
      finalize();
    };

    const finalize = () => {
      if (isFinalizing) return;
      isFinalizing = true;

      [currentInnerStream, input, output].forEach((stream) => {
        if (stream && stream[flags]?.isRunning) {
          stream[flags].isAutoComplete = true;
        }
      });

      currentInnerStream = null;
    };

    init();
    return output;
  };

  return createStreamOperator('fork', operator);
};
