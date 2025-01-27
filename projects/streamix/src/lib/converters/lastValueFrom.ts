import { Emission, internals, Stream } from '../abstractions';
import { EMPTY } from '../streams';

export async function lastValueFrom<T>(stream: Stream<T>): Promise<T> {
  if(stream === EMPTY || stream[internals].shouldComplete()) {
    throw new Error("Stream has not emitted any value.");
  }

  return new Promise<T>((resolve, reject) => {
    let hasEmitted = false;
    let lastValue: T;

    const subscription = stream({
      next: async (emission: Emission) => {
        if (!emission.error) {
          if(!hasEmitted) {
            hasEmitted = true;
          }
          lastValue = emission.value;
        } else {
          subscription.unsubscribe(); // Ensure cleanup
          reject(emission.error); // Reject on error
        }
      },
      complete: () => {
        subscription.unsubscribe();
        if (!hasEmitted) {
          reject(new Error("Stream has not emitted any value."));
        }
        resolve(lastValue);
      }
    });
  });
}
