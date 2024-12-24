import { createOperator, Emission, eventBus, flags, hooks, internals, Operator, Subscribable, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

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
    input[hooks].finalize.once(() => queueMicrotask(async () => executionCounter.waitFor(input!.emissionCounter).then(finalize)));
    output[hooks].finalize.once(finalize);
  };

  const handle = (emission: Emission) => {
    // Process the current emission and start a new inner stream
    queueMicrotask(() => processEmission(emission));

    emission.pending = true;
    return emission;
  };

  async function processEmission(emission: Emission) {
    // Attempt to project the emission into a new inner stream
    const [error, innerStream] = await catchAny(() => project(emission.value));

    if (error) {
      // Handle projection error by emitting an error event and marking the emission as a phantom
      eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
      executionCounter.increment();
      delete emission.pending;
      emission.phantom = true;
      return emission;
    }

    // If there's an existing inner stream and it's different from the new one, stop it
    if (previousInnerStream && previousInnerStream !== innerStream) {
      stopPreviousInnerStream();
    }

    // Subscribe to the new inner stream
    subscribeToInnerStream(innerStream, emission);

    // Update the reference to the current inner stream
    previousInnerStream = innerStream;

    emission.pending = true;
    return emission; // Return the processed emission
  }

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
    if (!output[internals].shouldComplete()) {
      emission.link(output.next(value));
    }
  };

  const handleStreamError = (_: Emission, error: any) => {
    eventBus.enqueue({ target: output, payload: { error }, type: 'error'});
    finalize();
  };

  const stopPreviousInnerStream = () => {
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
