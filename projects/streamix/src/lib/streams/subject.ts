import { Stream } from '../../lib';
import { promisified, PromisifiedType } from '../utils/promisified';

class Lock {
  private promise = Promise.resolve();

  async acquire(): Promise<void> {
    const release = this.promise;
    let resolve: () => void;
    this.promise = new Promise<void>((res) => (resolve = res!));
    await release;
    return resolve!;
  }
}

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable: PromisifiedType<void> = promisified<void>();
  protected spaceAvailable: PromisifiedType<void> = promisified<void>(); // Tracks when space becomes available
  protected buffer: Array<PromisifiedType<T> | null> = new Array(16).fill(null);
  protected head = 0;
  protected tail = 0;
  protected bufferSize = 16;
  protected bufferCount = 0;
  private lock = new Lock(); // Ensures only one next call at a time

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

            // Move head forward in cyclic buffer and decrement buffer count
            this.head = (this.head + 1) % this.bufferSize;
            this.bufferCount--;

            // Resolve the spaceAvailable promise if there's space now
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
    const releaseLock = await this.lock.acquire();

    try {
      // If the stream is stopped, we shouldn't allow further emissions
      if (this.isStopRequested || this.isStopped) {
        console.warn('Cannot push value to a stopped Subject.');
        return Promise.resolve();
      }

      // Wait until there is space in the buffer
      while (this.bufferCount === this.bufferSize) {
        await this.spaceAvailable.promise();
        this.spaceAvailable.reset(); // Reset the spaceAvailable promise
      }

      const promisifiedValue = promisified<T>(value);

      // Place the new value at the tail and advance the tail position
      this.buffer[this.tail] = promisifiedValue;
      this.tail = (this.tail + 1) % this.bufferSize;
      this.bufferCount++;

      // Signal that an emission is available
      this.emissionAvailable.resolve();

      // Return a promise that resolves when the value is emitted
      return promisifiedValue.then(() => Promise.resolve());
    } finally {
      // Release the lock so the next call can proceed
      releaseLock();
    }
  }
}
