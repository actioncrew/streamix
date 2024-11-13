import { createStream, Emission, Stream } from '../abstractions';
import { promisified, PromisifiedType } from '../utils';

export const eventBus = createBus() as Bus;
eventBus.subscribe();

// Define a functional lock for synchronizing access
export function createLock() {
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

export type BusEvent = {
  target: any,
  payload: any,
  type: 'emission' | 'start' | 'stop' | 'complete' | 'error';
  timeStamp?: Date
};

export type Bus<T = any> = Stream<T> & {
  enqueue(event: BusEvent): Promise<void>;
};

// Create the functional version of the Subject
export function createBus(): Bus {
  const bufferSize = 64;
  const buffer: Array<PromisifiedType<any> | null> = new Array(bufferSize).fill(null);
  let head = 0; let tail = 0;
  let itemsCount = 0;

  const emissionAvailable = promisified<void>();
  const spaceAvailable = promisified<void>();

  const lock = createLock(); // Functional lock for controlling access

  const bus = createStream(async function (this: any): Promise<void> {
    spaceAvailable.resolve(); // Initially, space is available

    while (true) {
      // Wait for the next emission or completion signal
      await Promise.race([emissionAvailable.promise(), this.awaitCompletion()]);

      if (this.shouldComplete() && itemsCount === 0) {
        break; // Exit the loop if there are no buffered values and the stream should complete
      }

      // Process each buffered value sequentially
      while (itemsCount > 0) {
        const promisifiedValue = buffer[head];
        if (promisifiedValue) {
          const event = promisifiedValue() as BusEvent;

          switch(event.type) {
            case 'start': event.target.onStart.parallel(event.payload); break;
            case 'stop': event.target.onStop.parallel(event.payload); break;
            case 'emission': event.target.onEmission.parallel(event.payload); break;
            case 'complete': event.target.onComplete.parallel(event.payload); break;
            case 'error': event.target.onError.parallel(event.payload); break;
          }

          promisifiedValue.resolve(event);

          // Move the head forward in the cyclic buffer and reduce the count
          head = (head + 1) % bufferSize;
          itemsCount--;

          // Resolve the spaceAvailable promise if there's space now
          if (itemsCount < bufferSize) {
            spaceAvailable.resolve();
          }
        }

        // Reset `emissionAvailable` after processing all buffered values
        emissionAvailable.reset();
      }
    }

    if (!this.shouldComplete()) {
      this.isAutoComplete = true;
    }
  }) as Bus;

  bus.enqueue = async function (this: Stream, event: BusEvent): Promise<void> {
    // If the stream is stopped, further emissions are not allowed
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped bus.');
      return Promise.resolve();
    }

    // Acquire the lock before proceeding
    const releaseLock = await lock.acquire();

    try {
      // Wait until there is space in the buffer
      if (itemsCount === bufferSize) {
        await spaceAvailable.promise();
        spaceAvailable.reset();
      }

      event.timeStamp = new Date();
      const promisifiedValue = promisified<any>(event);

      // Place the new value at the tail and advance the tail position
      buffer[tail] = promisifiedValue;
      tail = (tail + 1) % bufferSize;
      itemsCount++;

      // Resolve emissionAvailable if the buffer was empty
      emissionAvailable.resolve();

      return promisifiedValue.then(() => Promise.resolve());
    } finally {
      releaseLock(); // Release the lock after finishing
    }
  };

  bus.name = "bus";
  return bus;
}
