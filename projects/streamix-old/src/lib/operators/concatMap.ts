import { createEmission, createStreamOperator, Emission, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const concatMap = (project: (value: any) => Stream): StreamOperator => {
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
        next: (value) => {
          if (!output.shouldComplete()) {
            handle(createEmission({ value }));
          }
        },
        error: (err) => {
          output.error(err);
        },
        complete: () => {
          queueMicrotask(() =>
            executionCounter.waitFor(input.emissionCounter).then(finalize)
          );
        },
      });

      output.emitter.once('finalize', finalize);
    };

    const handle = (emission: Emission) => {
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
        output.error(error);
        emission.phantom = true;
        finalize();
        return;
      }

      currentInnerStream = innerStream;

      if (currentInnerStream) {
        return new Promise<void>((resolve) => {
          subscription = currentInnerStream!({
            next: (value) => {
              if (!output.shouldComplete()) {
                emission.link(output.next(value));
              }
            },
            error: (err) => {
              output.error(err);
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

      [currentInnerStream, input, output].forEach((stream) => {
        if (stream && stream?.isRunning) {
          stream.isAutoComplete = true;
        }
      });

      currentInnerStream = null;
    };

    init();
    return output;
  };

  return createStreamOperator('concatMap', operator);
};
