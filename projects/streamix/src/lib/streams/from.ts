import { createEmission, Emission } from '../abstractions';
import { createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export function from<T = any>(input: Iterable<T> | AsyncIterable<T>): Stream<T> {
  // Determine if the input is async or sync
  const isAsync = Symbol.asyncIterator in Object(input);
  const iterator = isAsync ? (input as AsyncIterable<T>)[Symbol.asyncIterator]() : (input as Iterable<T>)[Symbol.iterator]();

  let done = false;

  // Create the stream with a custom run function
  const stream = createStream<T>(async function(this: Stream<T>) {
    this.onComplete.once(() => {
      this.isAutoComplete = true;
    });

    while (!done && !this.shouldComplete()) {
      let result;

      // Handle async or sync iteration based on input type
      if (isAsync) {
        result = await (iterator as AsyncIterator<T>).next();
      } else {
        result = (iterator as Iterator<T>).next();
      }

      const { value, done: isDone } = result;
      if (isDone) {
        done = true;
      } else {
        const emission = createEmission({ value });
        eventBus.enqueue({ target: this, payload: { emission, source: this }, type: 'emission' });
      }
    }
  });

  stream.name = "from";
  return stream;
}
