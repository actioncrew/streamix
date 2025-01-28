import { Emission, internals, Stream } from '../../lib';
import { EMPTY } from '../streams';

export function firstValueFrom<T>(stream: Stream): Promise<T> {
  if(stream === EMPTY || stream[internals].shouldComplete()) {
    throw new Error("Stream has not emitted any value.");
  }

  return new Promise<any>((resolve, reject) => {
    let hasEmitted = false;

    const subscription = stream({
      next: async (emission: Emission) => {
        if (emission.isOk()) {
          if (!hasEmitted) {
            hasEmitted = true;
            subscription.unsubscribe(); // Unsubscribe once the first emission is received
            resolve(emission.value);
          }
        } else {
          subscription.unsubscribe(); // Ensure cleanup
          reject(emission.error);
        }
      },
      complete: () => {
        subscription.unsubscribe(); // Ensure cleanup
        if (!hasEmitted) {
          reject(new Error("Stream has not emitted any value."));
        }
      }
    });
  });
}
