import { createStream, Stream } from '../abstractions';
import { eventBus } from './bus';

export function of<T = any>(value: T): Stream<T> {
  // Create the custom run function for the OfStream
  const stream = createStream<T>(async function(this: Stream<T>): Promise<void> {
    try {
      if (!this.shouldComplete()) {
        eventBus.enqueue({ target: this, payload: { emission: { value }, source: this }, type: 'emission' });
        this.onComplete.once(() => {
          this.isAutoComplete = true; // Mark the stream for auto completion
        }) // Set auto-complete after emitting the value
      }
    } catch (error) {
      eventBus.enqueue({ target: this, payload: { emission: { error, isFailed: true }, source: this }, type: 'emission' });
    }
  });


  stream.name = "of";
  // Create the stream using createStream and the custom run function
  return stream;
}
