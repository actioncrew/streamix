import { createSubject, EMPTY, Subject } from '../streams';
import { Emission, createOperator, Operator, Subscribable, Subscription, hooks, flags } from '../abstractions';
import { Counter, catchAny, counter } from '../utils';
import { eventBus } from '../abstractions';

export const mergeMap = (project: (value: any) => Subscribable): Operator => {
  const output = createSubject();
  const activeInnerStreams: Set<Subscribable> = new Set();
  const processingPromises: Set<Promise<void>> = new Set();
  const executionCounter: Counter = counter(0);
  let input: Subscribable | undefined;
  let isFinalizing = false;

  // Initialize the operator with the input stream
  const init = (stream: Subscribable) => {
    input = stream;

    if (input === EMPTY) {
      // If the input stream is EMPTY, complete immediately
      output[flags].isAutoComplete = true;
      return;
    }

    // Finalize when either the input or output stream stops
    input[hooks].finalize.once(() =>
      queueMicrotask(() => executionCounter.waitFor(input!.emissionCounter).then(finalize))
    );
    output[hooks].finalize.once(finalize);
  };

  // Handle each emission from the input stream
  const handle = async (emission: Emission): Promise<Emission> => {
    queueMicrotask(() => processEmission(emission));
    emission.pending = true; // Mark emission as pending
    return emission;
  };

  // Process the emission by projecting it into an inner stream
  const processEmission = async (emission: Emission): Promise<void> => {
    const [error, innerStream] = await catchAny(() => project(emission.value));

    if (error) {
      // Handle errors in the projection function
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      executionCounter.increment();
      delete emission.pending;
      emission.phantom = true;
      return;
    }

    activeInnerStreams.add(innerStream);

    // Track the processing of the inner stream
    const processingPromise = new Promise<void>((resolve) => {
      const subscription = innerStream.subscribe({
        next: (value) => output.next(value), // Forward emissions from the inner stream
        error: (err) => {
          // Handle errors from the inner stream
          eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
          resolve(); // Resolve the processing promise to continue
        },
        complete: () => {
          // Clean up when the inner stream completes
          activeInnerStreams.delete(innerStream);
          executionCounter.increment();
          emission.finalize();
          resolve();
        },
      });

      // Cleanup when the processing is done
      processingPromises.add(processingPromise);
      processingPromise.finally(() => {
        processingPromises.delete(processingPromise);
        subscription.unsubscribe();
      });
    });

    processingPromises.add(processingPromise);
  };

  // Finalize the operator by cleaning up all resources
  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    // Wait for all active processing promises to complete
    await Promise.all(processingPromises);

    // Unsubscribe from all active inner streams
    activeInnerStreams.forEach((stream) => stream.complete());
    activeInnerStreams.clear();

    // Complete the output stream
    stopStream(output);

    // Mark the input stream as auto-complete if necessary
    if (input) stopStream(input);
  };

  // Helper to stop a stream gracefully
  const stopStream = (stream: Subscribable) => {
    stream[flags].isAutoComplete = true;
  };

  // Create and return the operator
  const operator = createOperator(handle) as any;
  operator.name = 'mergeMap';
  operator.init = init;
  operator.stream = output;

  return operator;
};
