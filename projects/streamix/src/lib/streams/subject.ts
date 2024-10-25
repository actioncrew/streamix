import { createStream, Stream } from '../../lib';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

export function createSubject<T = any>(): Subject<T> {
  const buffer: T[] = [];
  let isProcessing = false;

  // Create a stream using createStream and the custom run function
  const stream = createStream<T>(async function (this: any): Promise<void> {
    // Process the buffered values when the stream starts running
    if (buffer.length > 0) {
      await this.processBuffer();
    }

    // Await completion of the stream, processing values in real-time
    await this.awaitCompletion();
  }) as any;

  stream.next = async function (this: any, value?: T): Promise<void> {
    // If the stream is stopped, we shouldn't allow further emissions
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // If the stream is not running yet, buffer the value
    if (!this.isRunning) {
      buffer.push(value!);
    } else {
      // If running, enqueue the emission for sequential processing
      await this.enqueueEmission(value);
    }
  };

  stream.processBuffer = async function (this: any): Promise<void> {
    while (buffer.length > 0) {
      const value = buffer.shift(); // Get the first buffered value
      await this.processEmission(value); // Process each buffered emission sequentially
    }
  };

  stream.enqueueEmission = async function (this: any, value?: T): Promise<void> {
    if (isProcessing) {
      // If another emission is processing, just queue this emission
      buffer.push(value!);
    } else {
      // Start processing immediately if no other emission is being processed
      await this.processEmission(value);
    }
  };

  stream.processEmission = async function (this: any, value?: T): Promise<void> {
    isProcessing = true;

    try {
      await this.onEmission.process({ emission: { value }, source: this });
    } finally {
      // Ensure processing flag is reset when finished and process any buffered values
      isProcessing = false;
      if (buffer.length > 0) {
        await this.processBuffer();
      }
    }
  };

  return stream;
}
