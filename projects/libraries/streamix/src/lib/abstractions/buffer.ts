export type ReleaseFn = () => void;
export type SimpleLock = () => Promise<ReleaseFn>;

export const createLock = (): SimpleLock => {
  let locked = false;
  const queue: Array<(release: ReleaseFn) => void> = [];

  return () =>
    new Promise<ReleaseFn>((resolve) => {
      const acquire = () => {
        if (!locked) {
          locked = true;
          resolve(() => {
            locked = false;
            if (queue.length > 0) {
              const next = queue.shift()!;
              next(acquire);
            }
          });
        } else {
          queue.push(acquire);
        }
      };
      acquire();
    });
};

export type Semaphore = {
  acquire: () => Promise<ReleaseFn>;
  tryAcquire: () => ReleaseFn | null;
  release: () => void; // Explicit release method
};

export const createSemaphore = (initialCount: number): Semaphore => {
  let count = initialCount;
  const queue: Array<(release: ReleaseFn) => void> = [];

  const release = () => {
    count++;
    if (queue.length > 0) {
      const resolve = queue.shift()!;
      count--;
      resolve(() => {
        release();
      });
    }
  };

  const acquire = (): Promise<ReleaseFn> =>
    new Promise((resolve) => {
      if (count > 0) {
        count--;
        resolve(() => release());
      } else {
        queue.push(resolve);
      }
    });

  const tryAcquire = (): ReleaseFn | null => {
    if (count > 0) {
      count--;
      return () => release();
    }
    return null;
  };

  return { acquire, tryAcquire, release };
};

export function createQueue() {
  let last = Promise.resolve();

  const enqueue = (operation: () => Promise<any>): Promise<any> => {
    const result = last.then(() => operation());
    last = result.catch(() => {}); // prevent queue lock on error
    return result;
  };

  return { enqueue };
}

export type Buffer<T = any> = {
  write: (item: T) => Promise<void>;
  read: (readerId: number) => Promise<{ value: T | undefined, done: boolean }>;
  attachReader: () => Promise<number>;
  detachReader: (readerId: number) => void;
  complete: () => void;
  completed: (readerId: number) => boolean;
};

export function createBuffer<T = any>(capacity: number): Buffer<T> {
  const buffer: T[] = new Array(capacity);
  let writeIndex = 0;
  let readCount = 0; // Total number of items written
  const readerOffsets = new Map<number, number>(); // Tracks how many items each reader has consumed
  let readerIdCounter = 0;
  let isCompleted = false;

  const lock = createLock();
  const dataAvailable = createSemaphore(0);
  const spaceAvailable = createSemaphore(capacity);

  const write = async (item: T): Promise<void> => {
    await spaceAvailable.acquire();
    const releaseLock = await lock();

    try {
      buffer[writeIndex] = item;
      writeIndex = (writeIndex + 1) % capacity;
      readCount++;
      dataAvailable.release(); // Signal that new data is available
    } finally {
      releaseLock();
    }
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = readerIdCounter++;
      readerOffsets.set(readerId, readCount); // New reader starts at current write position
      return readerId;
    } finally {
      releaseLock();
    }
  };

  const complete = (): void => {
    isCompleted = true;
    dataAvailable.release(); // Wake up all waiting readers
  };

  const read = async (readerId: number): Promise<{ value: T | undefined, done: boolean }> => {
    while (true) {
      const releaseLock = await lock();
      try {
        const readerOffset = readerOffsets.get(readerId);
        if (readerOffset === undefined) {
          throw new Error("Reader ID not found.");
        }

        // Check if we're done
        if (isCompleted && readerOffset >= readCount) {
          return { value: undefined, done: true };
        }

        // Check if data is available
        if (readerOffset < readCount) {
          const readIndex = readerOffset % capacity;
          const value = buffer[readIndex];
          readerOffsets.set(readerId, readerOffset + 1);
          spaceAvailable.release(); // Free up a slot
          return { value, done: false };
        }
      } finally {
        releaseLock();
      }

      // Wait for new data or completion
      await dataAvailable.acquire();
    }
  };

  const detachReader = (readerId: number): void => {
    const releaseLockPromise = lock();
    releaseLockPromise.then(releaseLock => {
      try {
        const offset = readerOffsets.get(readerId) || 0;
        const consumed = readCount - offset;
        readerOffsets.delete(readerId);

        // Release any space that was reserved but not consumed
        for (let i = 0; i < consumed; i++) {
          spaceAvailable.release();
        }
      } finally {
        releaseLock();
      }
    });
  };

  const completed = (readerId: number): boolean => {
    const readerOffset = readerOffsets.get(readerId);
    if (readerOffset === undefined) {
      throw new Error("Reader ID not found.");
    }
    return isCompleted && readerOffset >= readCount;
  };

  return {
    write,
    read,
    attachReader,
    detachReader,
    complete,
    completed
  };
}
