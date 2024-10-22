import { Stream } from '../../lib';

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable = Promise.resolve();
  protected buffer: T[] = [];
  protected processing = false;  // Tracks if we're currently processing emissions

  constructor() {
    super();
  }

  async run(): Promise<void> {
    // Process the buffered values when the stream starts running
    if (this.buffer.length > 0) {
      await this.processBuffer();
    }

    // Await completion of the stream, processing values in real-time
    await this.awaitCompletion();
    return this.emissionAvailable;
  }

  async next(value?: T): Promise<void> {
    // If the stream is stopped, we shouldn't allow further emissions
    if (this.isStopped()) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // If the stream is not running yet, buffer the value
    if (!this.isRunning) {
      this.buffer.push(value!);
    } else {
      // If running, enqueue the emission for sequential processing
      await this.enqueueEmission(value);
    }

    return this.emissionAvailable;
  }

  // Processes buffered values in the correct order
  private async processBuffer(): Promise<void> {
    while (this.buffer.length > 0) {
      const value = this.buffer.shift(); // Get the first buffered value
      await this.processEmission(value); // Process each buffered emission sequentially
    }
  }

  // Enqueues and processes a new emission in sequence
  private async enqueueEmission(value?: T): Promise<void> {
    if (this.processing) {
      // Chain emissions to avoid overlapping async calls
      this.emissionAvailable = this.emissionAvailable.then(() => this.processEmission(value));
    } else {
      // Start processing immediately if no other emission is being processed
      await this.processEmission(value);
    }
  }

  // Helper method to process emissions in order
  protected async processEmission(value?: T): Promise<void> {
    this.processing = true;

    try {
      await this.onEmission.process({ emission: { value }, source: this });
    } finally {
      // Ensure processing flag is reset when finished
      this.processing = false;
    }
  }
}
