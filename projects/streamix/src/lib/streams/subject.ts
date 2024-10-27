import { Stream } from '../../lib';
import { promisified, PromisifiedType } from '../utils/promisified';

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable: PromisifiedType<void> = promisified<void>();
  protected buffer: Array<PromisifiedType<T> | null> = new Array(16).fill(null);
  protected head = 0;
  protected tail = 0;
  protected bufferSize = 16;
  protected bufferCount = 0;
  protected spaceAvailable: PromisifiedType<void> = promisified<void>(); // Tracks when space becomes available

  constructor() {
    super();
    this.spaceAvailable.resolve(); // Initially, space is available
  }

  async run(): Promise<void> {
    while (true) {
      // Wait for the next emission or completion signal
      await Promise.race([this.emissionAvailable.promise(), this.awaitCompletion()]);

      if (!this.shouldComplete() || this.bufferCount > 0) {
        // Process each buffered value sequentially
        while (this.bufferCount > 0) {
          const promisifiedValue = this.buffer[this.head];
          if (promisifiedValue) {
            const value = promisifiedValue()!;
            await this.onEmission.process({ emission: { value }, source: this });
            promisifiedValue.resolve(value);

            // Move the head forward in the cyclic buffer and reduce the count
            this.head = (this.head + 1) % this.bufferSize;
            this.bufferCount--;

            // Signal that space is now available
            if (this.bufferCount < this.bufferSize) {
              this.spaceAvailable.resolve();
            }
          }
        }

        // Reset emissionAvailable after processing all buffered values
        if (this.shouldComplete()) {
          break;
        }
      } else {
        break;
      }
    }
  }

  async next(value?: T): Promise<void> {
    // If the stream is stopped, we shouldn't allow further emissions
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // Wait until there is space in the buffer
    if (this.bufferCount !== 0) {
      await this.spaceAvailable.promise();
    }

    const promisifiedValue = promisified<T>(value);

    // Place the new value at the tail and advance the tail position
    this.buffer[this.tail] = promisifiedValue;
    this.tail = (this.tail + 1) % this.bufferSize;
    this.bufferCount++;

    // Reset the spaceAvailable promise if buffer is now full
    if (this.bufferCount === this.bufferSize) {
      this.spaceAvailable.reset();
    }

    this.emissionAvailable.resolve();
    return promisifiedValue.then(() => Promise.resolve());
  }
}
