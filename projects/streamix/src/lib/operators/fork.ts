import { createStreamOperator, flags, internals, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject } from '../streams';
import { catchAny, Counter, counter } from '../utils';
import { Emission } from './../abstractions/emission';

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
      // Subscribe to the inputStream
      subscription = input({
        next: async (emission: Emission) => {
          if (emission.isOk()) {
            if (!output[internals].shouldComplete()) {
              handleEmission(emission);
            }
          } else {
            output.error(emission.error);
          }
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
          output.error(error);
          emission.phantom = true;
          finalize();
          return;
        }

        currentInnerStream = innerStream;

        return new Promise<void>((resolve) => {
          subscription = currentInnerStream!({
            next: async (emission: Emission) => {
              if (emission.isOk()) {
                if (!output[internals].shouldComplete()) {
                  emission.link(output.next(emission.value));
                }
              } else {
                output.error(emission.error);
                resolve();
              }
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
        emission.error = new Error(`No handler found for value: ${emission.value}`);
        output.error(emission.error);
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
