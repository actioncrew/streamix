import { eventBus, flags, hooks } from '../abstractions';
import { Subscribable, Emission, createOperator, Operator } from '../abstractions';
import { catchAny, Counter, counter } from '../utils';
import { createSubject, EMPTY } from '../streams';
import { Subscription } from '../abstractions';

export const switchMap = (project: (value: any) => Subscribable): Operator => {
  let currentInnerStream: Subscribable | null = null;
  let previousInnerStream: Subscribable | null = null;
  let currentSubscription: Subscription | undefined;
  const executionCounter: Counter = counter(0);
  let isFinalizing: boolean = false;
  let input!: Subscribable | undefined;
  const output = createSubject();

  const init = (stream: Subscribable) => {
    input = stream;

    if (input === EMPTY) {
      // If the input stream is EMPTY, complete immediately
      output[flags].isAutoComplete = true;
      return;
    }

    // Finalize when the input or output stream stops
    input[hooks].onStop.once(() => queueMicrotask(async () => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output[hooks].onStop.once(finalize);
  };

  const handle = async (emission: Emission, stream: Subscribable) => {
    // Process the current emission and start a new inner stream
    const [error, innerStream] = await catchAny(() => project(emission.value));

    if (error) {
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      executionCounter.increment();
      emission.phantom = true;
      return emission;
    }

    // Cancel any existing inner subscription
    if(previousInnerStream && previousInnerStream !== innerStream) {
      stopPreviousInnerStream(emission);
    }

    // Subscribe to the new inner stream
    subscribeToInnerStream(innerStream, emission);

    previousInnerStream = innerStream;

    emission.pending = true;
    return emission;
  };

  const subscribeToInnerStream = (innerStream: Subscribable, emission: Emission) => {
    currentSubscription = innerStream.subscribe({
      next: (value) => {
        handleInnerEmission(emission, value);
      },
      error: (err) => {
        handleStreamError(emission, err);
      },
      complete: () => {
        executionCounter.increment();
        emission.finalize();
      }
    });
  };

  const handleInnerEmission = (emission: Emission, value: any) => {
    emission.link(output.next(value));
  };

  const handleStreamError = (emission: Emission, error: any) => {
    eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
    finalize();
  };

  const stopPreviousInnerStream = (emission: Emission) => {
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
