import { eventBus } from './../streams/bus';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { Counter, counter } from '../utils';
import { createSubject } from '../streams';
import { Subscription } from '../abstractions';

export const switchMap = (project: (value: any) => Subscribable): Operator => {
  let currentInnerStream: Subscribable | null = null;
  let currentSubscription: Subscription | undefined;
  let pendingEmissions: number = 0;
  const executionCounter: Counter = counter(0);
  let isFinalizing: boolean = false;
  let inputStream!: Subscribable | undefined;
  const outputStream = createSubject();

  const init = (stream: Subscribable) => {
    inputStream = stream;

    // Finalize when the input or output stream stops
    inputStream.onStop.once(() => queueMicrotask(() => executionCounter.waitFor(pendingEmissions).then(finalize)));
    outputStream.onStop.once(finalize);
  };

  const handle = async (emission: Emission, stream: Subscribable) => {
    // Increment pending emissions for lifecycle tracking
    pendingEmissions++;

    // Process the current emission and start a new inner stream
    const newInnerStream = project(emission.value);

    // Cancel any existing inner subscription
    if(currentInnerStream !== newInnerStream) {
      stopCurrentInnerStream();
    }

    currentInnerStream = newInnerStream;

    // Subscribe to the new inner stream
    if (currentInnerStream) {
      currentSubscription = currentInnerStream.subscribe((value) => handleInnerEmission(value));

      // Handle errors from the inner stream
      currentInnerStream.onError.once(({ error }: any) => handleStreamError(error));

      // Complete the inner stream when it stops
      currentInnerStream.onStop.once(() => stopCurrentInnerStream());
    }

    // Mark the outer emission as phantom (already processed)
    emission.phantom = true;

    return emission;
  };

  const handleInnerEmission = (value: any) => {
    outputStream.next(value);
  };

  const handleStreamError = (error: any) => {
    eventBus.enqueue({ target: outputStream, payload: { error }, type: 'error' });
    finalize();
  };

  const stopCurrentInnerStream = () => {
    executionCounter.increment();
    // Unsubscribe and clean up the current inner stream
    currentSubscription?.unsubscribe();
    currentSubscription = undefined;
    currentInnerStream = null;
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    // Stop all streams (input, current inner, output)
    stopStreams(inputStream, currentInnerStream, outputStream);
    currentInnerStream = null;
  };

  const stopStreams = (...streams: (Subscribable | null | undefined)[]) => {
    streams
      .filter((stream) => stream && stream.isRunning)
      .forEach((stream) => {
        stream!.isAutoComplete = true;
      });
  };

  const operator = createOperator(handle) as any;
  operator.name = 'switchMap';
  operator.init = init;
  operator.stream = outputStream;

  return operator;
};
