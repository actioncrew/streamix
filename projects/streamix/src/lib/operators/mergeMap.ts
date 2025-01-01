import { createOperator, Emission, eventBus, flags, hooks, StreamOperator, Subscribable, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const mergeMap = (project: (value: any) => Subscribable): StreamOperator => {
  return (inputStream) => {
    const outputStream = createSubject();
    let activeInnerStreams: Subscribable[] = [];
    const subscriptions: Subscription[] = [];
    const processingPromises: Promise<void>[] = [];
    const executionCounter: Counter = counter(0);
    let isFinalizing = false;

    const init = () => {
      if (inputStream === EMPTY) {
        outputStream[flags].isAutoComplete = true;
        return;
      }

      inputStream[hooks].finalize.once(() =>
        queueMicrotask(() => executionCounter.waitFor(inputStream.emissionCounter).then(finalize))
      );

      outputStream[hooks].finalize.once(finalize);
    };

    const handleEmission = (emission: Emission): Emission => {
      queueMicrotask(() => processEmission(emission));
      emission.pending = true;
      return emission;
    };

    const processEmission = async (emission: Emission): Promise<void> => {
      const [error, innerStream] = await catchAny(() => project(emission.value));

      if (error) {
        eventBus.enqueue({ target: outputStream, payload: { error }, type: 'error' });
        executionCounter.increment();
        emission.phantom = true;
        delete emission.pending;
        return;
      }

      activeInnerStreams.push(innerStream);

      const processingPromise = new Promise<void>((resolve) => {
        const subscription = innerStream.subscribe({
          next: (value) => emission.link(outputStream.next(value)),
          error: (err) => {
            eventBus.enqueue({ target: outputStream, payload: { error: err }, type: 'error' });
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

    const finalizeInnerStream = (innerStream: Subscribable) => {
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
      inputStream[flags].isAutoComplete = true;
      outputStream[flags].isAutoComplete = true;
    };

    const operator = createOperator(handleEmission);
    operator.name = 'mergeMap';
    operator.init = init;

    init();
    return outputStream;
  };
};
