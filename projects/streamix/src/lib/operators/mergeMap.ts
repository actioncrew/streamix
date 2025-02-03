import { Emission, Operator, Subscribable, Subscription, createOperator, eventBus, flags } from '../abstractions';
import { EMPTY, createSubject } from '../streams';
import { Counter, catchAny, counter } from '../utils';

export const mergeMap = (project: (value: any) => Subscribable): Operator => {
  const output = createSubject();
  let activeInnerStreams: Set<Subscribable> = new Set();
  let processingPromises: Promise<void>[] = [];
  const executionCounter: Counter = counter(0);
  let isFinalizing = false;
  let input: Subscribable | undefined;

  // Array to track active subscriptions for inner streams
  const subscriptions: Map<Subscribable, Subscription> = new Map();

  const init = (stream: Subscribable) => {
    input = stream;

    if (input === EMPTY) {
      output[flags].isAutoComplete = true;
      return;
    }

    input.emitter.once('finalize', () => queueMicrotask(() => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output.emitter.once('finalize', finalize);
  };

  const handle = (emission: Emission): Emission => {
    queueMicrotask(() => processEmission(emission));
    emission.pending = true;
    return emission;
  };

  const processEmission = async (emission: Emission): Promise<void> => {
    const [error, innerStream] = await catchAny(() => project(emission.value));

    if (error) {
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      executionCounter.increment();
      delete emission.pending;
      emission.phantom = true;
      return;
    }

    activeInnerStreams.add(innerStream);

    const processingPromise = new Promise<void>((resolve) => {
      const subscription = innerStream.subscribe({
        next: (value) => emission.link(output.next(value)),
        error: (err) => {
          eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
          resolve();
        },
        complete: () => {
          removeInnerStream(innerStream);
          executionCounter.increment();
          emission.finalize();
          resolve();
        },
      });

      subscriptions.set(innerStream, subscription);
    }) as any;

    processingPromises.push(processingPromise);
  };

  const removeInnerStream = (innerStream: Subscribable) => {
    const subscription = subscriptions.get(innerStream);
    if (subscription) {
      subscription.unsubscribe();
      subscriptions.delete(innerStream);
    }
    activeInnerStreams.delete(innerStream);
  };

  const finalize = () => {
    if (isFinalizing) return;
    isFinalizing = true;

    subscriptions.forEach(subscription => subscription.unsubscribe());
    subscriptions.clear();
    activeInnerStreams.clear();
    stopInputStream();
    stopOutputStream();
  };

  const stopInputStream = () => {
    input![flags].isAutoComplete = true;
  };

  const stopOutputStream = () => {
    output[flags].isAutoComplete = true;
  };

  const operator = createOperator(handle) as any;
  operator.name = 'mergeMap';
  operator.init = init;
  operator.stream = output;
  return operator;
};
