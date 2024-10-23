import { Subject } from '../../lib';
import { createOperator, Emission, Stream, Subscribable } from '../abstractions';

export const switchMap = (project: (value: any) => Subscribable) => {
  let activeInnerStream: Subscribable | null = null;
  let isFinalizing = false;

  const output = new Subject();

  const init = (stream: Stream) => {
    stream.onStop.once(() => finalize());
    output.onStop.once(() => finalize());
  }

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    await stopInnerStream();
    if (!output.isStopped) {
      await output.complete();
    }
  };

  const stopInnerStream = async () => {
    if (activeInnerStream) {
      activeInnerStream.complete();
      activeInnerStream = null;
    }
  };

  const handle = async (emission: Emission, stream: Subscribable): Promise<Emission> => {
    if (stream.shouldComplete()) {
      emission.isPhantom = true;
      await stopInnerStream();
      return emission;
    }

    return processEmission(emission, output);
  };

  const processEmission = async (emission: Emission, stream: Subject): Promise<Emission> => {
    const newInnerStream = project(emission.value);

    if (activeInnerStream === newInnerStream) {
      emission.isPhantom = true;
      return emission;
    }

    await stopInnerStream();
    activeInnerStream = newInnerStream;

    const handleInnerEmission = async ({ emission: innerEmission }: { emission: Emission }) => {
      if (!stream.shouldComplete()) {
        await stream.next(innerEmission.value);
      }
    };

    activeInnerStream.onEmission.chain(handleInnerEmission);

    activeInnerStream.onError.once((error: any) => {
      emission.error = error;
      emission.isFailed = true;
      removeInnerStream(activeInnerStream!);
    });

    activeInnerStream.onStop.once(() => removeInnerStream(activeInnerStream!));

    activeInnerStream.start();

    emission.isPhantom = true;
    return new Promise<Emission>((resolve) => {
      activeInnerStream!.onStop.once(() => resolve(emission));
    });
  };

  const removeInnerStream = (innerStream: Subscribable) => {
    if (activeInnerStream === innerStream) {
      activeInnerStream = null;
    }
  };

  const operator = createOperator(handle) as any;
  operator.name = 'switchMap';
  operator.init = init;
  operator.stream = output;
  return operator;
};
