import { createStream, promisified, PromisifiedType, Stream } from '../../lib';

export type Subject<T = any> = Stream<T> & {
  next(value?: T): Promise<void>;
};

export function createLock() {
  let currentPromise = Promise.resolve();
  let resolveNext: (() => void) | undefined;

  async function acquire(): Promise<void> {
    const release = currentPromise;
    currentPromise = new Promise<void>((res) => (resolveNext = res));
    await release;
    return resolveNext!;
  }

  return { acquire };
}

export function createSubject<T = any>(): Subject<T> {
  const buffer: Array<PromisifiedType<T> | null> = new Array(16).fill(null);
  const bufferSize = 16;
  let head = 0;
  let tail = 0;
  let bufferCount = 0;

  let emissionAvailable = promisified<void>(); // Tracks emissions
  let spaceAvailable = promisified<void>(); // Tracks when space is available
  spaceAvailable.resolve(); // Initially, space is available

  // Lock promise for managing concurrent access to `next`
  let lock = createLock();

  const stream = createStream<T>(async function (this: any): Promise<void> {
    while (true) {
      await Promise.race([emissionAvailable.promise(), this.awaitCompletion()]);

      if (!this.shouldComplete() || bufferCount > 0) {
        while (bufferCount > 0) {
          const promisifiedValue = buffer[head];
          if (promisifiedValue) {
            const value = promisifiedValue()!;
            await this.onEmission.process({ emission: { value }, source: this });
            promisifiedValue.resolve(value);

            head = (head + 1) % bufferSize;
            bufferCount--;

            // Signal that space is now available
            if (bufferCount === bufferSize - 1) {
              spaceAvailable.resolve();
            }
          }
        }

        if (this.shouldComplete()) {
          break;
        }
      } else {
        break;
      }
    }
  }) as any;

  stream.next = async function (this: Stream, value?: T): Promise<void> {
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    // Acquire lock for buffer access
    await lock.acquire();
    
    if (bufferCount === bufferSize) {
      await spaceAvailable.promise();
    }

    const promisifiedValue = promisified<T>(value);
    buffer[tail] = promisifiedValue;
    tail = (tail + 1) % bufferSize;
    bufferCount++;

    // Reset spaceAvailable if buffer is now full
    if (bufferCount === bufferSize) {
      spaceAvailable = promisified<void>();
    }

    emissionAvailable.resolve();

    return promisifiedValue.then(() => Promise.resolve());
  };

  stream.name = "subject";
  return stream;
}
