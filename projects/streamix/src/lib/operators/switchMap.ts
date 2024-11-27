import { eventBus, flags, hooks } from '../abstractions';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { Counter, counter } from '../utils';
import { createSubject } from '../streams';
import { Subscription } from '../abstractions';

export const switchMap = (project: (value: any) => Subscribable): Operator => {
  let currentInnerStream: Subscribable | null = null;
  let currentSubscription: Subscription | undefined;
  const executionCounter: Counter = counter(0);
  let isFinalizing: boolean = false;
  let input!: Subscribable | undefined;
  const output = createSubject();

  const init = (stream: Subscribable) => {
    input = stream;

    // Finalize when the input or output stream stops
    input[hooks].onStop.once(() => queueMicrotask(() => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output[hooks].onStop.once(finalize);
  };

  const handle = async (emission: Emission, stream: Subscribable) => {
    // Process the current emission and start a new inner stream
    const newInnerStream = project(emission.value);

    // Cancel any existing inner subscription
    if(currentInnerStream && currentInnerStream !== newInnerStream) {
      currentSubscription?.unsubscribe();
      currentSubscription = undefined;
    }

    currentInnerStream = newInnerStream;

    // Subscribe to the new inner stream
    if (currentInnerStream) {
      currentSubscription = currentInnerStream.subscribe({
        next: (value) => handleInnerEmission(emission, value),
        error: (err) => handleStreamError(emission, err),
        complete: () => stopCurrentInnerStream(emission)
      });
    }

    emission.pending = true;
    return emission;
  };

  const handleInnerEmission = (emission: Emission, value: any) => {
    emission.link(output.next(value));
  };

  const handleStreamError = (emission: Emission, error: any) => {
    eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
    finalize();
  };

  const stopCurrentInnerStream = (emission: Emission) => {
    executionCounter.increment();
    emission.finalize();
    currentSubscription?.unsubscribe();
    currentSubscription = undefined;
    currentInnerStream = null;
  };

  const finalize = () => {
    if (isFinalizing) return;
    isFinalizing = true;

    // Stop all streams (input, current inner, output)
    stopStreams(input, currentInnerStream, output);
    currentInnerStream = null;
  };

  const stopStreams = (...streams: (Subscribable | null | undefined)[]) => {
    streams
      .filter((stream) => stream && stream[flags].isRunning)
      .forEach((stream) => {
        stream![flags].isAutoComplete = true;
      });
  };

  const operator = createOperator(handle) as any;
  operator.name = 'switchMap';
  operator.init = init;
  operator.stream = output;

  return operator;
};
