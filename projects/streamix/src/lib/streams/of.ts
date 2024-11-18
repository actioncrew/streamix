import { createEmission, createStream, Stream } from '../abstractions';
import { eventBus } from '../abstractions';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    this.onComplete.once(() => {
      this.isAutoComplete = true;
    })

    try {
      if (!this.shouldComplete()) {
        eventBus.enqueue({ target: this, payload: { emission: createEmission({ value }), source: this }, type: 'emission' });
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { emission: createEmission({ error, failed: true }), source: this }, type: 'emission' });
    }
  });


  stream.name = "of";
  // Create the stream using createStream and the custom run function
  return stream;
}
