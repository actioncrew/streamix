export type ReleaseFn = () => void;
export type SimpleLock = () => Promise<ReleaseFn>;

export const createLock = (): SimpleLock => {
  let locked = false;
  const queue: Array<(release: ReleaseFn) => void> = [];

  return () => new Promise<ReleaseFn>(resolve => {
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
    new Promise(resolve => {
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

export type Buffer<T = any> = {
  write: (item: T) => Promise<void>;
  read: (readerId: number) => Promise<T>;
  attachReader: () => Promise<number>;
  detachReader: (readerId: number) => void;
};

export const createBuffer = <T = any>(capacity: number): Buffer<T> => {
  const buffer: Array<T> = new Array(capacity);
  let writeIndex = 0;
  let oldestIndex = 0; // Tracks the oldest unread data in the buffer
  const readerPositions = new Map<number, number>();
  const readerSemaphores = new Map<number, Semaphore>();
  let readerIdCounter = 0;

  const lock = createLock();
  const notFull = createSemaphore(capacity);

  const write = async (item: T): Promise<void> => {
    await notFull.acquire();
    const releaseLock = await lock();

    // Prevent overwriting unread data
    for (const [readerId, readerIndex] of readerPositions) {
      if (readerIndex === writeIndex) {
        releaseLock();
        throw new Error("Writer is trying to overwrite unread data.");
      }
    }

    buffer[writeIndex] = item;
    writeIndex = (writeIndex + 1) % capacity;

    // Update oldestIndex if the buffer is completely filled
    if (writeIndex === oldestIndex) {
      oldestIndex = (oldestIndex + 1) % capacity;
    }

    for (const semaphore of readerSemaphores.values()) {
      semaphore.release(); // Notify readers of new data
    }

    releaseLock();
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();

    const readerId = readerIdCounter++;
    readerPositions.set(readerId, writeIndex); // Start at the current write position
    readerSemaphores.set(readerId, createSemaphore(0)); // Create a semaphore for this reader

    releaseLock();
    return readerId;
  };

  const read = async (readerId: number): Promise<T> => {
    const semaphore = readerSemaphores.get(readerId);
    if (!semaphore) {
      throw new Error("Reader ID not found.");
    }

    await semaphore.acquire(); // Wait until new data is available

    const releaseLock = await lock();
    try {
      const readIndex = readerPositions.get(readerId);
      if (readIndex === undefined) {
        throw new Error("Reader ID not found.");
      }

      const data = buffer[readIndex];
      readerPositions.set(readerId, (readIndex + 1) % capacity);

      // Update oldestIndex to the earliest unread position among all readers
      oldestIndex = Math.min(
        ...Array.from(readerPositions.values()),
        oldestIndex
      );

      return data;
    } finally {
      releaseLock();
    }
  };

  const detachReader = async (readerId: number): Promise<void> => {
    const releaseLock = await lock();

    readerPositions.delete(readerId);
    readerSemaphores.delete(readerId);

    // Recalculate oldestIndex to ensure it's accurate
    if (readerPositions.size > 0) {
      oldestIndex = Math.min(...readerPositions.values());
    } else {
      oldestIndex = writeIndex; // If no readers, reset oldestIndex to writeIndex
    }

    releaseLock();
  };

  return {
    write,
    read,
    attachReader,
    detachReader,
  };
};
