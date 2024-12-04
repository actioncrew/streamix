import { createEmission, createStream, flags, hooks, internals, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    try {
      if (!this[internals].shouldComplete()) {
        eventBus.enqueue({ target: this, payload: { emission: createEmission({ value }), source: this }, type: 'emission' });
        this[flags].isAutoComplete = true;
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { error }, type: 'error' });
    }
  });


  stream.name = "of";
  // Create the stream using createStream and the custom run function
  return stream;
}
