import { Subscribable, Emission, createOperator, Subscription } from '../abstractions';
import { Subject, createSubject } from '../streams';
import { CounterType, counter } from '../utils';

export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T) => boolean; handler: () => Subscribable<R> }>
) => {
  let innerStream: Subscribable<R> | null = null;
  let queue: Emission[] = [];
  let emissionNumber: number = 0;
  let executionNumber: CounterType = counter(0);
  let isFinalizing: boolean = false;
  let subscription: Subscription;

  let input!: Subscribable | undefined;
  const output = createSubject();

  const init = (stream: Subscribable) => {
    input = stream;
    input.onStop.once(() => {
      executionNumber.waitFor(emissionNumber).then(finalize);
    });
    output.onStop.once(finalize);
  };

  const handle = async (emission: Emission, stream: Subscribable) => {
    emissionNumber++;
    queue.push(emission);

    // Ensure processing continues if not already in progress
    await processQueue();

    // Mark the original emission as processed
    emission.isPhantom = true;
    return emission;
  };

  const processQueue = async (): Promise<void> => {
    while (queue.length > 0) {
      const nextEmission = queue.shift(); // Get the next emission from the queue
      if (nextEmission) {
        await processEmission(nextEmission, output); // Process the emission
      }
    }
  };

  const processEmission = async (emission: Emission, stream: Subject): Promise<void> => {
    // Find the matching case based on the selector
    const matchedCase = options.find(({ on }) => on(emission.value));

    if (matchedCase) {
      innerStream = matchedCase.handler(); // Use the selected stream

      await handleInnerStream(emission, innerStream); // Handle the inner stream
    } else {
      // If no case matches, emit an error
      await handleStreamError(emission, `No handler found for value: ${emission.value}`, finalize);
    }
  };

  const handleInnerStream = async (emission: Emission, stream: Subscribable): Promise<void> => {
    return new Promise<void>((resolve) => {
      const handleCompletion = async () => {

        innerStream = null; // Clear inner stream reference
        executionNumber.increment(); // Increment execution count

        resolve(); // Resolve the promise when done
        // Continue processing the queue
        await processQueue();
      };

      // Handle errors from the inner stream
      innerStream!.onError.once((error: any) => {
        handleStreamError(emission, error, handleCompletion);
      });

      innerStream!.onStop.once((error: any) => {
        handleCompletion();
        subscription.unsubscribe();
      });

      subscription = innerStream!.subscribe(value => handleInnerEmission(value)); // Start the inner stream
    });
  };

  const handleInnerEmission = async (value: any) => {
    await output.next(value); // Emit the inner emission
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
  operator.name = 'fork';
  operator.init = init;
  operator.stream = output;

  return operator;
};
