import { createSubject, Subject } from '../../lib';
import { Emission, createOperator, Subscribable } from '../abstractions';
import { CounterType, counter } from '../utils';

export const mergeMap = (project: (value: any) => Subscribable) => {
  let output = createSubject();
  let activeInnerStreams: Subscribable[] = [];
  let processingPromises: Promise<void>[] = [];

  let emissionNumber: number = 0;
  let executionNumber: CounterType = counter(0);
  let handleInnerEmission: (({ emission, source }: any) => Promise<void>) | null = null;
  let isFinalizing: boolean = false;

  const init = (input: Subscribable) => {
    input.onStop.once(() => executionNumber.waitFor(emissionNumber).then(finalize));
    output.onStop.once(finalize);
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    emissionNumber++;

    // Process the emission in parallel with other emissions
    processEmission(emission, output);

    // Return the phantom emission immediately
    emission.isPhantom = true;
    return emission;
  };

  const processEmission = async (emission: Emission, stream: Subject): Promise<void> => {
    const innerStream = project(emission.value);
    activeInnerStreams.push(innerStream);

    const processingPromise = new Promise<void>((resolve) => {
      const promises: Set<Promise<void>> = new Set();

      const handleCompletion = async () => {
        await Promise.all(promises);
        executionNumber.increment();
        removeInnerStream(innerStream);

        processingPromises = processingPromises.filter(p => p !== processingPromise);
        resolve();
      };

      if (!handleInnerEmission) {
        handleInnerEmission = async ({ emission: innerEmission }: any) => {
          // Gather promises from stream.next() to ensure parallel processing
          promises.add(
            stream.next(innerEmission.value).catch((error) => {
              emission.error = error;
              emission.isFailed = true;
            })
          );
        };
      }

      innerStream.onEmission.chain(handleInnerEmission);

      innerStream.onError.once((error: any) => {
        emission.error = error;
        emission.isFailed = true;
        innerStream.onEmission.remove(handleInnerEmission!);
        handleCompletion();
      });

      innerStream.onStop.once(() => {
        innerStream.onEmission.remove(handleInnerEmission!);
        handleCompletion();
      });

      innerStream.start(); // Start the inner stream
    });

    processingPromises.push(processingPromise);

    processingPromise.finally(() => {
      if (stream.shouldComplete()) {
        finalize();
      }
    });
  };

  const removeInnerStream = (innerStream: Subscribable) => {
    const index = activeInnerStreams.indexOf(innerStream);
    if (index !== -1) {
      activeInnerStreams.splice(index, 1);
    }
  };

  const finalize = async () => {
    if (isFinalizing) { return; }
    isFinalizing = true;

    await Promise.all(activeInnerStreams.map(stream => stream.complete()));
    activeInnerStreams = [];
    await stopInputStream();
    await stopOutputStream();
  };

  const stopInputStream = async () => {
    // Implementation to stop the input stream if needed
  };

  const stopOutputStream = async () => {
    if (output) {
      await output.complete();
    }
  };

  const operator = createOperator(handle) as any;
  operator.name = 'mergeMap';
  operator.init = init;
  operator.stream = output;
  return operator;
};
