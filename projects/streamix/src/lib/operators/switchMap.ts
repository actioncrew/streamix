import { createEmission, createOperator, Emission, eventBus, flags, hooks, internals, StreamOperator, Subscribable, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const switchMap = (project: (value: any) => Subscribable): StreamOperator => {
  return (inputStream) => {
    const output = createSubject();
    let currentInnerStream: Subscribable | null = null;
    let currentSubscription: Subscription | undefined;
    const executionCounter: Counter = counter(0);
    let isFinalizing = false;

    const init = () => {
      if (inputStream === EMPTY) {
        output[flags].isAutoComplete = true;
        return;
      }

      // Subscribe to the inputStream
      const subscription = inputStream.subscribe({
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
            executionCounter.waitFor(inputStream.emissionCounter).then(finalize)
          );
        },
      });

      output[hooks].finalize.once(finalize);
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

      stopStreams(inputStream, currentInnerStream, output);
      currentInnerStream = null;
    };

    const stopStreams = (...streams: (Subscribable | null | undefined)[]) => {
      streams
        .filter((stream) => stream && stream[flags].isRunning)
        .forEach((stream) => {
          stream![flags].isAutoComplete = true;
        });
    };

    const operator = createOperator(handleEmission);
    operator.name = 'switchMap';
    operator.init = init;

    init();
    return output;
  };
};
