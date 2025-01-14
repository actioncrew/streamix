import { createEmission, createStreamOperator, Emission, eventBus, flags, internals, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const switchMap = (project: (value: any) => Stream): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject();
    let currentInnerStream: Stream | null = null;
    let currentSubscription: Subscription | undefined;
    const executionCounter: Counter = counter(0);
    let isFinalizing = false;

    const init = () => {
      if (input === EMPTY) {
        output[flags].isAutoComplete = true;
        return;
      }

      // Subscribe to the inputStream
      const subscription = input.subscribe({
        next: (value) => {
          if (!output[internals].shouldComplete()) {
            handleEmission(createEmission({ value }));
          }
        },
        error: (err) => {
          eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
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
        eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
        executionCounter.increment();
        delete emission.pending;
        emission.phantom = true;
        return;
      }

      if (currentInnerStream && currentInnerStream !== innerStream) {
        stopCurrentInnerStream();
      }

      currentInnerStream = innerStream;

      currentSubscription = innerStream.subscribe({
        next: (value) => {
          if (!output[internals].shouldComplete()) {
            emission.link(output.next(value));
          }
        },
        error: (err) => {
          eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
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
        .filter((stream) => stream && stream[flags].isRunning)
        .forEach((stream) => {
          stream![flags].isAutoComplete = true;
        });
    };

    init();
    return output;
  };

  return createStreamOperator('switchMap', operator);
};
