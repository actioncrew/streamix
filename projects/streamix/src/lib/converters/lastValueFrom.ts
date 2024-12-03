import { internals, Subscribable } from '../abstractions';
import { EMPTY } from '../streams';

export async function lastValueFrom<T>(stream: Subscribable<T>): Promise<T> {
  if(stream === EMPTY || stream[internals].shouldComplete()) {
    throw new Error("Subscribable has not emitted any value.");
  }

  return new Promise<T>((resolve, reject) => {
    let hasEmitted = false;
    let lastValue: T;

    const subscription = stream.subscribe({
      next: (value: T) => {
        if(!hasEmitted) {
          hasEmitted = true;
        }
        lastValue = value;
      },
      complete: () => {
        subscription.unsubscribe();
        if (!hasEmitted) {
          reject(new Error("Subscribable has not emitted any value."));
        }
        resolve(lastValue);
      },
      error: (err) => {
        subscription.unsubscribe(); // Ensure cleanup
        reject(err); // Reject on error
      }
    });
  });
}
