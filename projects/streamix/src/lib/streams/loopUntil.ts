import { Emission, Subscribable } from '../abstractions';
import { createStream, Stream } from '../abstractions/stream';

export function loopUntil<T>(
  initialValue: T,
  stopCondition$: Subscribable<any>, // Observable that signals when to stop
  iterateFn: (value: T) => T
): Stream<T> {
  let currentValue = initialValue;
  let stopConditionReached = false;

  // Create the stream with a custom run function
  const stream = createStream<T>(async function(this: Stream<T>) {
    // Create a subscription to the stop condition
    const subscription = stopCondition$.subscribe(() => {
      stopConditionReached = true;
    });

    while (!stopConditionReached && !this.shouldComplete()) {
      const emission = { value: currentValue } as Emission;

      // Emit the current value
      await this.onEmission.parallel({ emission, source: this });

      // Apply the iterateFn to get the next value
      currentValue = iterateFn(currentValue);
    }

    // Cleanup the stop condition subscription
    subscription.unsubscribe();
  });

  stream.name = "loopUntil";
  return stream;
}
