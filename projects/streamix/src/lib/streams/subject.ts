import { createStream, promisified, PromisifiedType, Stream } from '../../lib';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

export function createSubject<T = any>(): Subject<T> {
  const buffer: PromisifiedType<T>[] = [];
  let emissionAvailable = promisified<void>(); // Initialize emissionAvailable

  // Create a stream using createStream and the custom run function
  const stream = createStream<T>(async function (this: any): Promise<void> {
    while (true) {
      // Wait for the next emission or completion signal
      await Promise.race([emissionAvailable.promise(), this.awaitCompletion()]);

      if(!this.shouldComplete() || this.buffer.length > 0) {
        // Process each buffered value sequentially
        while (buffer.length > 0) {
          const promisifiedValue = buffer.shift()!;
          const value = promisifiedValue()!;
          await this.onEmission.process({ emission: { value }, source: this });
          promisifiedValue.resolve(value);
        }

        // Reset emissionAvailable after processing all buffered values
        if(this.shouldComplete()) {
          break;
        }

      } else { break; }
    }
  }) as any;

  stream.next = async function(this: Stream, value?: T): Promise<void> {
    // If the stream is stopped, we shouldn't allow further emissions
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    const promisifiedValue = promisified<T>(value);
    buffer.push(promisifiedValue);
    emissionAvailable.resolve();
    return promisifiedValue.then(() => Promise.resolve());
  }

  stream.name = "subject";
  return stream;
}
