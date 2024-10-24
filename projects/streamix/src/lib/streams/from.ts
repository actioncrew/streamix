import { Emission } from '../abstractions';
import { createStream, Stream } from '../abstractions/stream';

export function from<T = any>(input: any[] | IterableIterator<any>): Stream<T> {
  const iterator = Array.isArray(input) ? input[Symbol.iterator]() : input;

  let done = false;

  // Create the stream with a custom run function
  const stream = createStream<T>(async function() {
    while (!done && !stream.shouldComplete()) {
      const { value, done: isDone } = iterator.next();
      if (isDone) {
        done = true;
        if (!stream.shouldComplete()) {
          stream.isAutoComplete = true; // Mark the stream for auto-completion
        }
      } else {
        const emission = { value } as Emission;
        await stream.onEmission.process({ emission, source: stream });

        if (emission.isFailed) {
          throw emission.error;
        }
      }
    }
  });

  return stream;
}
