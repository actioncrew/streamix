import { Stream } from '../../lib';
import { promisified, PromisifiedType } from '../utils/promisified';

export class Lock {
  private promise = Promise.resolve();

  async acquire(): Promise<() => void> {
    const release = this.promise; // Wait on the current promise
    let resolve: () => void;
    this.promise = new Promise<void>(res => (resolve = res!)); // Create a new promise
    await release; // Wait for the previous promise to resolve
    return resolve!; // Return the resolve function
  }
}

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable: PromisifiedType<void> = promisified<void>();
  protected buffer: Array<PromisifiedType<T> | null> = new Array(16).fill(null);
  protected headPointer = 0;
  protected tailPointer = 0;
  protected bufferSize = 16;
  protected bufferCount = 0;
  protected spaceAvailable: PromisifiedType<void> = promisified<void>();
  private lock = new Lock(); // Lock instance for synchronization

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
          const promisifiedValue = this.buffer[this.headPointer];
          if (promisifiedValue) {
            const value = promisifiedValue()!;
            await this.onEmission.parallel({ emission: { value }, source: this });
            promisifiedValue.resolve(value);

            // Move the head forward in the cyclic buffer and reduce the count
            this.headPointer = (this.headPointer + 1) % this.bufferSize;
            this.bufferCount--;

            // Resolve the spaceAvailable promise if there's space now
            if (this.bufferCount < this.bufferSize) {
              this.spaceAvailable.resolve();
            }
          }
        }

        // Reset `emissionAvailable` after processing all buffered values
        this.emissionAvailable.reset();

        // If the stream should complete, exit the loop
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

    // Acquire the lock before proceeding
    const releaseLock = await this.lock.acquire();

    try {
      // Wait until there is space in the buffer
      if (this.bufferCount === this.bufferSize) {
        // Wait for space to become available
        await this.spaceAvailable.promise();
      }

      const promisifiedValue = promisified<T>(value);

      // Place the new value at the tail and advance the tail position
      this.buffer[this.tailPointer] = promisifiedValue;
      this.tailPointer = (this.tailPointer + 1) % this.bufferSize;
      this.bufferCount++;

      // If the buffer was empty, we resolve emissionAvailable
      this.emissionAvailable.resolve();

      return promisifiedValue.then(() => Promise.resolve());
    } finally {
      releaseLock(); // Release the lock
    }
  }
}
