import { createSubject, EMPTY, Subject } from '../streams';
import { Emission, createOperator, Operator, Subscribable, Subscription, hooks, flags } from '../abstractions';
import { Counter, catchAny, counter } from '../utils';
import { eventBus } from '../abstractions';

export const mergeMap = (project: (value: any) => Subscribable): Operator => {
  const output = createSubject();
  let activeInnerStreams: Subscribable[] = [];
  let processingPromises: Promise<void>[] = [];
  const executionNumber: Counter = counter(0);
  let isFinalizing = false;
  let input: Subscribable | undefined;

  // Array to track active subscriptions for inner streams
  const subscriptions: Subscription[] = [];

  const init = (stream: Subscribable) => {
    input = stream;

    if (input === EMPTY) {
      // If the input stream is EMPTY, complete immediately
      output[flags].isAutoComplete = true;
      return;
    }

    // Finalize when the input or output stream stops
    input[hooks].finalize.once(() => queueMicrotask(() => executionNumber.waitFor(input!.emissionCounter).then(finalize)));
    output[hooks].finalize.once(finalize);
  };

  const handle = async (emission: Emission): Promise<Emission> => {

    // Process the emission asynchronously
    processEmission(emission, output);

    // Mark the emission as phantom and return immediately
    emission.pending = true;
    return emission;
  };

  const processEmission = async (emission: Emission, stream: Subject): Promise<void> => {
    const [error, innerStream] = await catchAny(() => project(emission.value));

    if (error) {
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      executionNumber.increment();
      emission.phantom = true;
      return;
    }

    activeInnerStreams.push(innerStream);

    const processingPromise = new Promise<void>((resolve) => {

      const handleCompletion = async () => {
        removeInnerStream(innerStream);

        executionNumber.increment();
        emission.finalize();

        processingPromises = processingPromises.filter((p) => p !== processingPromise);
        resolve();
      };

      const handleInnerEmission = (value: any) => {
        // Add promises from stream.next() to ensure parallel processing
        emission.link(stream.next(value));
      };

      const handleStreamError = (err: any) => {
        eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
        finalize();
      }

      // Subscribe to inner stream emissions
      const subscription = innerStream.subscribe({
        next: handleInnerEmission,
        error: handleStreamError,
        complete: handleCompletion
      });

      // Add the unsubscribe function to the subscriptions array
      subscriptions.push(subscription);
    }) as any;

    processingPromises.push(processingPromise);
  };

  const removeInnerStream = (innerStream: Subscribable) => {
    // Remove the unsubscribe function from the subscriptions array and unsubscribe
    const index = activeInnerStreams.indexOf(innerStream);
    if (index !== -1) {
      subscriptions[index].unsubscribe(); // Call the unsubscribe function
      activeInnerStreams.splice(index, 1);
      subscriptions.splice(index, 1); // Remove the unsubscribe function from the array
    }
  };

  const finalize = () => {
    if (isFinalizing) return;
    isFinalizing = true;

    subscriptions.forEach(subscription => subscription.unsubscribe());
    subscriptions.length = 0;

    activeInnerStreams = [];
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
