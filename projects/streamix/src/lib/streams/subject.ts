import { Stream } from '../../lib';
import { promisified, PromisifiedType } from '../utils/promisified';

export class Lock {
  private promise: Promise<void> = Promise.resolve(); // Initialize with a resolved promise

  async acquire(): Promise<() => void> {
    const release = this.promise; // Save the current promise to wait for it to resolve
    let resolve: () => void;

    // Create a new promise that will be resolved when the lock is released
    this.promise = new Promise<void>((res) => (resolve = res!));

    await release; // Wait for the previous promise to resolve
    return resolve!; // Return the resolve function for releasing the lock
  }
}

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

export function createSubject<T = any>(): Subject<T> {
  const buffer: Array<PromisifiedType<T> | null> = new Array(16).fill(null);
  const bufferSize = 16;
  let head = 0;
  let tail = 0;
  let bufferCount = 0;

  let emissionAvailable = promisified<void>(); // Initialize emissionAvailable
  let spaceAvailable = promisified<void>(); // Initialize spaceAvailable

  // Functional lock instance
  const lock = createLock();

  // Create a stream using createStream and the custom run function
  const stream = createStream<T>(async function (this: any): Promise<void> {
    while (true) {
      // Wait for the next emission or completion signal
      await Promise.race([emissionAvailable.promise(), this.awaitCompletion()]);

      if (!this.shouldComplete() || bufferCount > 0) {
        // Process each buffered value sequentially
        while (bufferCount > 0) {
          const promisifiedValue = buffer[head];
          if (promisifiedValue) {
            const value = promisifiedValue()!;
            await this.onEmission.process({ emission: { value }, source: this });
            promisifiedValue.resolve(value);

            // Move head forward in cyclic buffer and decrement buffer count
            head = (head + 1) % bufferSize;
            bufferCount--;

            // Resolve the spaceAvailable promise if there's space now
            if (bufferCount < bufferSize) {
              spaceAvailable.resolve();
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
  }) as any;

  stream.next = async function (this: Stream, value?: T): Promise<void> {
    // If the stream is stopped, we shouldn't allow further emissions
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // Acquire the lock before proceeding
    const releaseLock = await lock.acquire();

    try {
      // Wait until there is space in the buffer
      if (bufferCount === bufferSize) {
        // Wait for space to become available
        await spaceAvailable.promise();
      }

      const promisifiedValue = promisified<T>(value);

      // Place the new value at the tail and advance the tail position
      buffer[tail] = promisifiedValue;
      tail = (tail + 1) % bufferSize;
      bufferCount++;

      // If the buffer was empty, we resolve emissionAvailable
      if (bufferCount === 1) {
        emissionAvailable.resolve(); // Only resolve if this is the first element
      }
    } finally {
      releaseLock(); // Release the lock
    }

    return promisifiedValue.then(() => Promise.resolve());
  };

  stream.name = "subject";
  return stream;
}
