import { createEmission, createStreamOperator, Emission, eventBus, flags, internals, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const mergeMap = (project: (value: any) => Stream): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject();
    let activeInnerStreams: Stream[] = [];
    const subscriptions: Subscription[] = [];
    const processingPromises: Promise<void>[] = [];
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
          queueMicrotask(() =>
            executionCounter.waitFor(input.emissionCounter).then(finalize)
          );
        },
      });

      output.emitter.once('finalize', finalize);
      subscriptions.push(subscription);
    };

    const handleEmission = (emission: Emission): Emission => {
      queueMicrotask(() => processEmission(emission));
      emission.pending = true;
      return emission;
    };

    const processEmission = async (emission: Emission): Promise<void> => {
      const [error, innerStream] = await catchAny(() => project(emission.value));

      if (error) {
        eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
        executionCounter.increment();
        emission.phantom = true;
        delete emission.pending;
        return;
      }

      activeInnerStreams.push(innerStream);

      const processingPromise = new Promise<void>((resolve) => {
        const subscription = innerStream.subscribe({
          next: (value) => emission.link(output.next(value)),
          error: (err) => {
            eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
            resolve();
          },
          complete: () => {
            finalizeInnerStream(innerStream);
            resolve();
          },
        });

        subscriptions.push(subscription);
      });

      processingPromises.push(processingPromise);
    };

    const finalizeInnerStream = (innerStream: Stream) => {
      const index = activeInnerStreams.indexOf(innerStream);
      if (index !== -1) {
        subscriptions[index].unsubscribe();
        activeInnerStreams.splice(index, 1);
        subscriptions.splice(index, 1);
      }
      executionCounter.increment();
    };

    const finalize = () => {
      if (isFinalizing) return;
      isFinalizing = true;

      subscriptions.forEach((subscription) => subscription.unsubscribe());
      subscriptions.length = 0;

      activeInnerStreams = [];
      stopStreams();
    };

    const stopStreams = () => {
      input[flags].isAutoComplete = true;
      output[flags].isAutoComplete = true;
    };

    init();
    return output;
  };

  return createStreamOperator('mergeMap', operator);
};
