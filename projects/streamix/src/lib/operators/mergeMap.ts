import { createEmission, createStreamOperator, Emission, eventBus, flags, internals, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject, EMPTY } from '../streams';
import { catchAny, Counter, counter } from '../utils';

export const mergeMap = (project: (value: any) => Stream): StreamOperator => {
  const operator = (input: Stream) => {
    const output = createSubject();
    const activeStreams: Map<Stream, Subscription> = new Map();
    const executionCounter: Counter = counter(0);
    let subscription: Subscription | undefined;
    let isFinalizing = false;

    const init = () => {
      if (input === EMPTY) {
        output[flags].isAutoComplete = true;
        return;
      }

      // Subscribe to the inputStream
      subscription = input({
        next: (value) => {
          if (!output[internals].shouldComplete()) {
            handleEmission(createEmission({ value }));
          }
        },
        error: (err) => {
          eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
        },
        complete: () => {
          queueMicrotask(() =>
            executionCounter.waitFor(input.emissionCounter).then(finalize)
          );
        },
      });

      output.emitter.once('finalize', finalize);
    };

    const handleEmission = (emission: Emission): Emission => {
      queueMicrotask(() => processEmission(emission));
      emission.pending = true;
      return emission;
    };

    const processEmission = async (emission: Emission): Promise<void> => {
      const [error, innerStream] = await catchAny(() => project(emission.value));

      if (error) {
        eventBus.enqueue({ target: output, payload: { error }, type: 'error' });
        executionCounter.increment();
        emission.phantom = true;
        delete emission.pending;
        return;
      }

      if(!activeStreams.has(innerStream)) {
        const subscription = innerStream({
          next: (value) => emission.link(output.next(value)),
          error: (err) => {
            eventBus.enqueue({ target: output, payload: { error: err }, type: 'error' });
          },
          complete: () => {
            finalizeInnerStream(innerStream);
          },
        });

        activeStreams.set(innerStream, subscription);
      }
    };

    const finalizeInnerStream = (innerStream: Stream) => {
      if(activeStreams.has(innerStream)) {
        activeStreams.get(innerStream)!.unsubscribe();
        activeStreams.delete(innerStream);
      }

      executionCounter.increment();
    };

    const finalize = () => {
      if (isFinalizing) return;
      isFinalizing = true;
      stopStreams();
    };

    const stopStreams = () => {
      subscription?.unsubscribe();
      output[flags].isAutoComplete = true;
    };

    init();
    return output;
  };

  return createStreamOperator('mergeMap', operator);
};
