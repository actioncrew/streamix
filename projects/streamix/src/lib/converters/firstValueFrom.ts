import { internals, Stream } from '../../lib';
import { EMPTY } from '../streams';

export function firstValueFrom<T>(stream: Stream): Promise<T> {
  if(stream === EMPTY || stream[internals].shouldComplete()) {
    throw new Error("Stream has not emitted any value.");
  }

  return new Promise<any>((resolve, reject) => {
    let hasEmitted = false;

    const subscription = stream({
      next: (value: T) => {
        if (!hasEmitted) {
          hasEmitted = true;
          subscription.unsubscribe(); // Unsubscribe once the first emission is received
          resolve(value);
        }
      },
      complete: () => {
        subscription.unsubscribe(); // Ensure cleanup
        if (!hasEmitted) {
          reject(new Error("Stream has not emitted any value."));
        }
      },
      error: (err) => {
        subscription.unsubscribe(); // Ensure cleanup
        reject(err); // Reject on error
      }
    });
  });
}
