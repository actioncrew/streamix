import { Emission } from '../abstractions';
import { createStream, Stream } from '../abstractions/stream';

export function from<T = any>(input: any[] | IterableIterator<any>): Stream<T> {
  const iterator = Array.isArray(input) ? input[Symbol.iterator]() : input;

  let done = false;

  // Create the stream with a custom run function
  const stream = createStream<T>(async function(this: Stream<T>) {
    while (!done && !this.shouldComplete()) {
      const { value, done: isDone } = iterator.next();
      if (isDone) {
        done = true;
        if (!this.shouldComplete()) {
          this.isAutoComplete = true; // Mark the stream for auto-completion
        }
      } else {
        const emission = { value } as Emission;
        await this.onEmission.process({ emission, source: this });

        if (emission.isFailed) {
          throw emission.error;
        }
      }
    }
  });

  return stream;
}
