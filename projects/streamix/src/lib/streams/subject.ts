import { createStream, Stream } from '../../lib';

export interface Subject<T = any> extends Stream<T> {
  next(value?: T): Promise<void>;
}

export function createSubject<T = any>(): Subject<T> {
  // Buffer to hold values until the stream is running
  let buffer: T[] = [];
  let processing = false; // Tracks if we're currently processing emissions
  let emissionAvailable = Promise.resolve(); // Tracks the availability of emissions

  // Custom run method for the Subject
  async function run(): Promise<void> {
    // Process the buffered values when the stream starts running
    if (buffer.length > 0) {
      await processBuffer();
    }

    // Await completion of the stream, processing values in real-time
    await awaitCompletion();
    return emissionAvailable;
  }

  // Initialize the stream with the custom run function
  const subject = createStream<T>(run) as Subject<T>;
  const { awaitCompletion, isRunning, isStopped, isStopRequested, onEmission } = subject;

  // Function to process buffered values in the correct order
  async function processBuffer(): Promise<void> {
    while (buffer.length > 0) {
      const value = buffer.shift(); // Get the first buffered value
      await processEmission(value); // Process each buffered emission sequentially
    }
  }

  // Function to enqueue an emission for processing
  async function enqueueEmission(value?: T): Promise<void> {
    if (processing) {
      // Chain emissions to avoid overlapping async calls
      emissionAvailable = emissionAvailable.then(() => processEmission(value));
    } else {
      // Start processing immediately if no other emission is being processed
      await processEmission(value);
    }
  }

  // Helper method to process emissions in order
  async function processEmission(value?: T): Promise<void> {
    processing = true;

    try {
      await onEmission.process({ emission: { value }, source: subject });
    } finally {
      processing = false;
    }
  }

  // Define the next method to push values to the Subject
  subject.next = async (value?: T): Promise<void> => {
    // If the stream is stopped, we shouldn't allow further emissions
    if (isStopRequested || isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // If the stream is not running yet, buffer the value
    if (!isRunning) {
      buffer.push(value!);
    } else {
      // If running, enqueue the emission for sequential processing
      await enqueueEmission(value);
    }

    return emissionAvailable;
  };

  return subject;
}
