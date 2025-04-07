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

export type Buffer<T> = {
  write: (item: T) => Promise<void>;
  read: (readerId: number) => Promise<T>;
  attachReader: () => Promise<number>;
  detachReader: (readerId: number) => void;
};

export const createBuffer = <T>(capacity: number): MultiReaderBuffer<T> => {
  const buffer: Array<T> = new Array(capacity);
  let writeIndex = 0;
  const readerPositions = new Map<number, number>();
  const readerSemaphores = new Map<number, Semaphore>();
  let readerIdCounter = 0;

  const lock = createLock();
  const notFull = createSemaphore(capacity);

  const write = async (item: T): Promise<void> => {
    await notFull.acquire();
    const releaseLock = await lock();

    buffer[writeIndex] = item;
    writeIndex = (writeIndex + 1) % capacity;

    for (const semaphore of readerSemaphores.values()) {
      semaphore.release(); // Notify the respective reader that new data is available
    }

    releaseLock();
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();

    const readerId = readerIdCounter++;
    readerPositions.set(readerId, writeIndex); // Start reading from the current write position
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

      return data;
    } finally {
      releaseLock();
    }
  };

  const detachReader = async (readerId: number): Promise<void> => {
    const releaseLock = await lock();

    readerPositions.delete(readerId);
    readerSemaphores.delete(readerId);

    releaseLock();
  };

  return {
    write,
    read,
    attachReader,
    detachReader,
  };
};
