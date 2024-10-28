import { Subscribable, Emission, createOperator } from '../abstractions';
import { CounterType, Subject, counter, createSubject } from '../../lib';

export const concatMap = (project: (value: any) => Subscribable) => {
  let innerStream: Subscribable | null = null;
  let processingPromise: Promise<void> | null = null;

  let queue: Emission[] = [];
  let emissionNumber: number = 0;
  let executionNumber: CounterType = counter(0);
  let isFinalizing: boolean = false;

  let input!: Subscribable | undefined;
  const output = createSubject();

  const init = (stream: Subscribable) => {
    input = stream;
    input.onStop.once(() => {
      executionNumber.waitFor(emissionNumber).then(finalize);
    });
    output.onStop.once(finalize);
  };

  // Declare handleInnerEmission here to make it visible in the closure
  const handleInnerEmission = async ({ emission: innerEmission }: { emission: Emission }) => {
    await output.next(innerEmission.value); // Emit the inner emission
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    emissionNumber++;
    queue.push(emission);

    // Ensure processing continues if not already in progress
    processingPromise = processingPromise || processQueue();
    await processingPromise;
    processingPromise = null;

    emission.isPhantom = true; // Mark as phantom emission
    return emission; // Return the original emission
  };

  const processQueue = async (): Promise<void> => {
    while (queue.length > 0 && !innerStream) {
      const nextEmission = queue.shift(); // Get the next emission from the queue
      if (nextEmission) {
        await processEmission(nextEmission, output); // Process the emission
      }
    }
  };

  const processEmission = async (emission: Emission, stream: Subject): Promise<void> => {
    innerStream = project(emission.value); // Create inner stream using the provided project function
    await handleInnerStream(emission, stream); // Handle the inner stream
  };

  const handleInnerStream = async (emission: Emission, stream: Subject): Promise<void> => {
    return new Promise<void>((resolve) => {
      const handleCompletion = async () => {
        if (innerStream) {
          innerStream.onEmission.remove(handleInnerEmission); // Clean up inner stream subscription
        }
        innerStream = null; // Clear inner stream reference
        executionNumber.increment(); // Increment execution count

        resolve(); // Resolve the promise when done
        // Continue processing the queue
        await processQueue();
      };

      innerStream!.onEmission.chain(handleInnerEmission); // Subscribe to emissions from the inner stream

      // Handle errors from the inner stream
      innerStream!.onError.once((error: any) => {
        handleStreamError(emission, error, handleCompletion);
      });

      // Ensure inner stream completion is handled
      innerStream!.onStop.once(() => handleCompletion());
      innerStream!.subscribe(); // Start the inner stream
    });
  };

  const handleStreamError = (emission: Emission, error: any, callback: () => void) => {
    emission.error = error;
    emission.isFailed = true;
    stopStreams(innerStream, output); // Stop the streams
    callback(); // Call the callback to complete the inner stream handling
  };

  const finalize = async () => {
    if (isFinalizing) { return; }
    isFinalizing = true;

    if (innerStream) {
      innerStream.onEmission.remove(handleInnerEmission); // Clean up inner stream subscription
    }
    await stopStreams(innerStream, input, output); // Stop relevant streams
    innerStream = null; // Clear inner stream reference
  };

  const stopStreams = async (...streams: (Subscribable | null | undefined)[]) => {
    await Promise.all(streams.filter(stream => stream?.isRunning).map(stream => stream!.complete()));
  };

  const operator = createOperator(handle) as any;
  operator.name = 'concatMap';
  operator.init = init;
  operator.stream = output;

  return operator;
};
