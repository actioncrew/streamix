import { Stream } from '../../lib';

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable = Promise.resolve();
  private buffer: T[] = [];

  constructor() {
    super();
  }

  async run(): Promise<void> {
    // Process the buffered values first when the stream starts running
    if (this.buffer.length > 0) {
      for (const value of this.buffer) {
        await this.processEmission(value);
      }
      this.buffer = [];  // Clear the buffer once all values have been emitted
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
    if (!this.isRunning()) {
      this.buffer.push(value!);
    } else {
      // If running, process the emission immediately
      await this.processEmission(value);
    }

    return this.emissionAvailable;
  }

  // Helper method to process emissions and chain them into emissionAvailable
  private async processEmission(value?: T): Promise<void> {
    this.emissionAvailable = this.emissionAvailable.then(() =>
      this.onEmission.process({ emission: { value }, source: this })
    );
    return this.emissionAvailable;
  }
}
