import { Subscribable } from '../abstractions/subscribable';

export function lastValueFrom(stream: Subscribable): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    let hasEmitted = false;
    let lastValue: any;

    const emissionHandler = async ({ emission }: any) => {
      lastValue = emission.value;
      hasEmitted = true;
    };

    try {
      // Chain the emission handler to capture each emission's value
      stream.onEmission.chain(emissionHandler);

      // Set up onStop handler to resolve with last value or reject if no emission occurred
      stream.onStop.once(() => {
        stream.onEmission.remove(emissionHandler);

        if (hasEmitted) {
          resolve(lastValue);
        } else {
          reject("Subscribable has not emitted any value.");
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
