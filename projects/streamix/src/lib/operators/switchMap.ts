import { createEmission, createStreamOperator, Emission, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const switchMap = (project: (value: any) => Stream): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject();
    let currentInnerStream: Stream | null = null;
    let currentSubscription: Subscription | undefined;
    const executionCounter: Counter = counter(0);
    let isFinalizing = false;

    const init = () => {
      // Subscribe to the inputStream
      const subscription = input({
        next: (value) => {
          if (!output.shouldComplete()) {
            handleEmission(createEmission({ value }));
          }
        },
        error: (err) => {
          output.error(err);
        },
        complete: () => {
          subscription.unsubscribe();
          queueMicrotask(() =>
            executionCounter.waitFor(input.emissionCounter).then(finalize)
          );
        },
      });

      output.emitter.once('finalize', finalize);
    };

    const handleEmission = (emission: Emission): Emission => {
      queueMicrotask(() => processEmission(emission));
      emission.pending = true;
      return emission;
    };

    const processEmission = async (emission: Emission) => {
      const [error, innerStream] = await catchAny(() => project(emission.value));

      if (error) {
        output.error(error);
        executionCounter.increment();
        delete emission.pending;
        emission.phantom = true;
        return;
      }

      if (currentInnerStream && currentInnerStream !== innerStream) {
        stopCurrentInnerStream();
      }

      currentInnerStream = innerStream;

      currentSubscription = innerStream({
        next: (value) => {
          if (!output.shouldComplete()) {
            emission.link(output.next(value));
          }
        },
        error: (err) => {
          output.error(err);
          finalize();
        },
        complete: () => {
          executionCounter.increment();
          emission.finalize();
        },
      });
    };

    const stopCurrentInnerStream = () => {
      currentSubscription?.unsubscribe();
      currentSubscription = undefined;
      currentInnerStream = null;
    };

    const finalize = () => {
      if (isFinalizing) return;
      isFinalizing = true;

      stopStreams(input, currentInnerStream, output);
      currentInnerStream = null;
    };

    const stopStreams = (...streams: (Stream | null | undefined)[]) => {
      streams
        .filter((stream) => stream && stream.isRunning)
        .forEach((stream) => {
          stream!.isAutoComplete = true;
        });
    };

    init();
    return output;
  };

  return createStreamOperator('switchMap', operator);
};
