import { createStream, promisified, PromisifiedType, Stream } from '../../lib';

// Define a functional lock for synchronizing access
function createLock() {
  let promise = Promise.resolve();

  async function acquire() {
    const release = promise; // Wait on the current promise
    let resolve: () => void;
    promise = new Promise<void>((res) => (resolve = res!)); // Create a new promise for the next lock acquisition
    await release; // Wait for the previous promise to resolve
    return resolve!; // Return the resolve function
  }

  return { acquire };
}

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

// Create the functional version of the Subject
export function createSubject<T = any>(): Subject<T> {
  const buffer: Array<PromisifiedType<T> | null> = new Array(16).fill(null);
  const bufferSize = 16;
  let head = 0;
  let tail = 0;
  let bufferCount = 0;

  const emissionAvailable = promisified<void>();
  const spaceAvailable = promisified<void>();
  spaceAvailable.resolve(); // Initially, space is available

  const lock = createLock(); // Functional lock for controlling access

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

            // Move the head forward in the cyclic buffer and reduce the count
            head = (head + 1) % bufferSize;
            bufferCount--;

            // Resolve the spaceAvailable promise if there's space now
            if (bufferCount < bufferSize) {
              spaceAvailable.resolve();
            }
          }
        }

        // Reset `emissionAvailable` after processing all buffered values
        emissionAvailable.reset();

        // If the stream should complete, exit the loop
        if (this.shouldComplete()) {
          break;
        }
      } else {
        break;
      }
    }
  }) as any;

  stream.next = async function (this: Stream, value?: T): Promise<void> {
    // If the stream is stopped, further emissions are not allowed
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // Acquire the lock before proceeding
    const releaseLock = await lock.acquire();

    try {
      // Wait until there is space in the buffer
      if (bufferCount === bufferSize) {
        await spaceAvailable.promise();
        spaceAvailable.reset();
      }

      const promisifiedValue = promisified<T>(value);

      // Place the new value at the tail and advance the tail position
      buffer[tail] = promisifiedValue;
      tail = (tail + 1) % bufferSize;
      bufferCount++;

      // Resolve emissionAvailable if the buffer was empty
      emissionAvailable.resolve();

      return promisifiedValue.then(() => Promise.resolve());
    } finally {
      releaseLock(); // Release the lock after finishing
    }
  };

  stream.name = "subject";
  return stream;
}
