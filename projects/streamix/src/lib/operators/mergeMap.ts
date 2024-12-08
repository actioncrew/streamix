import { createSubject, EMPTY, Subject } from '../streams';
import { Emission, createOperator, Operator, Subscribable, Subscription, hooks, flags } from '../abstractions';
import { Counter, catchAny, counter } from '../utils';
import { eventBus } from '../abstractions';

export const mergeMap = (project: (value: any) => Subscribable): Operator => {
  const output = createSubject();
  let activeInnerStreams: Subscribable[] = [];
  let processingPromises: Promise<void>[] = [];
  const executionCounter: Counter = counter(0);
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
    input[hooks].finalize.once(() => queueMicrotask(() => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output[hooks].finalize.once(finalize);
  };

  const handle = (emission: Emission): Emission => {

    // Process the emission asynchronously
    queueMicrotask(() => processEmission(emission, output));

    // Mark the emission as phantom and return immediately
    emission.pending = true;
    return emission;
  };

  const processEmission = async (emission: Emission, stream: Subject): Promise<void> => {
    const [error, innerStream] = await catchAny(() => project(emission.value));

    if (error) {
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      executionCounter.increment();
      delete emission.pending;
      emission.phantom = true;
      return;
    }

    activeInnerStreams.push(innerStream);

    const processingPromise = new Promise<void>((resolve) => {

      const subscription = innerStream.subscribe({
        next: (value) => emission.link(output.next(value)), // Forward emissions from the inner stream
        error: (err) => {
          // Handle errors from the inner stream
          eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
          resolve(); // Resolve the processing promise to continue
        },
        complete: () => {
          // Clean up when the inner stream completes
          removeInnerStream(innerStream);
          executionCounter.increment();
          emission.finalize();
          resolve();
        },
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
