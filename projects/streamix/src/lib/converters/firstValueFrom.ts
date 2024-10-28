import { Subscribable } from '../abstractions/subscribable';

export function firstValueFrom(stream: Subscribable): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    let hasEmitted = false;

    const emissionHandler = async ({ emission }: any) => {
      if (!hasEmitted) {
        hasEmitted = true;
        stream.onEmission.remove(emissionHandler);
        resolve(emission.value);
      }
    };

    try {
      // Chain the emission handler to capture the first emission
      stream.onEmission.chain(emissionHandler);

      // Set up onStop handler to clean up and reject if no emission occurred
      stream.onStop.once(() => {
        stream.onEmission.remove(emissionHandler);

        if (!hasEmitted) {
          reject("Subscribable has not emitted any value.");
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
