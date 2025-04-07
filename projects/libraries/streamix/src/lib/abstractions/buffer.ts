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
  const readerPositions = new Map<number, number>();
  const readerSemaphores = new Map<number, Semaphore>();
  let readerIdCounter = 0;

  const lock = createLock();
  const notFull = createSemaphore(capacity);
  
  // Track which positions have been fully consumed by all readers
  const isPositionReadByAll = (position: number): boolean => {
    for (const readerPos of readerPositions.values()) {
      // If any reader hasn't yet read this position, return false
      if (position === readerPos) {
        return false;
      }
    }
    return true;
  };

  const write = async (item: T): Promise<void> => {
    await notFull.acquire();
    const releaseLock = await lock();

    // Prevent overwriting unread data
    for (const [, readerIndex] of readerPositions) {
      if (readerIndex === writeIndex) {
        releaseLock();
        throw new Error("Writer is trying to overwrite unread data.");
      }
    }

    buffer[writeIndex] = item;
    writeIndex = (writeIndex + 1) % capacity;

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
  
    await semaphore.acquire();

    const releaseLock = await lock();
    try {
      const readIndex = readerPositions.get(readerId);
      if (readIndex === undefined) {
        throw new Error("Reader ID not found.");
      }

      const data = buffer[readIndex];
      const oldReadIndex = readIndex;
      const newReadIndex = (readIndex + 1) % capacity;
      readerPositions.set(readerId, newReadIndex);

      // Check if the position we just read from is now fully consumed by all readers
      // If so, we can release a slot in the notFull semaphore
      if (isPositionReadByAll(oldReadIndex)) {
        notFull.release();
      }

      return data;
    } finally {
      releaseLock();
    }
  };

  const detachReader = (readerId: number): void => {
    const releaseLock = lock();
    releaseLock().then(release => {
      const oldPosition = readerPositions.get(readerId);
      readerPositions.delete(readerId);
      readerSemaphores.delete(readerId);
      
      // Check if removing this reader freed up any positions
      // This is important when detaching readers to prevent deadlocks
      if (oldPosition !== undefined) {
        for (let i = 0; i < capacity; i++) {
          const pos = (oldPosition + i) % capacity;
          if (isPositionReadByAll(pos)) {
            notFull.release();
          }
        }
      }
      
      release();
    });
  };

  return {
    write,
    read,
    attachReader,
    detachReader,
  };
};
