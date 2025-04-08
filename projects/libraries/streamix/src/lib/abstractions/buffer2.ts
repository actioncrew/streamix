export type ReleaseFn = () => void;

// Lock implementation (added from previous example)
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

// Semaphore implementation (added from previous example)
export type Semaphore = {
  acquire: () => Promise<ReleaseFn>;
  tryAcquire: () => ReleaseFn | null;
  release: () => void;
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
  read: (readerId: number) => Promise<{ value: T | undefined; done: boolean }>;
  attachReader: () => Promise<number>;
  detachReader: (readerId: number) => void;
  complete: () => void;
  isCompleted: () => boolean;
};

export function createBuffer<T = any>(capacity: number): Buffer<T> {
  const buffer: T[] = new Array(capacity);
  let writeIndex = 0;
  let readCount = 0; // Total items written
  const readerOffsets = new Map<number, number>(); // Tracks how many items each reader has consumed
  let readerIdCounter = 0;
  let completed = false; // Renamed from isCompleted to avoid conflict
  let activeReaders = 0;

  // Synchronization primitives
  const lock = createLock();
  const readSemaphore = createSemaphore(0); // Signals data availability
  const writeSemaphore = createSemaphore(capacity); // Tracks free slots
  
  // --- Writer Logic ---
  const write = async (item: T): Promise<void> => {
    if (completed) {
      throw new Error("Cannot write to a completed buffer");
    }

    const writeRelease = await writeSemaphore.acquire(); // Wait for a free slot
    const releaseLock = await lock();

    try {
      buffer[writeIndex] = item;
      writeIndex = (writeIndex + 1) % capacity;
      readCount++;
      
      // Signal all readers about new data
      readSemaphore.release(); 
    } finally {
      releaseLock();
    }
  };

  // Helper: Find the minimum offset across all readers
  const getMinReaderOffset = (): number => {
    let minOffset = readCount;
    for (const offset of readerOffsets.values()) {
      if (offset < minOffset) {
        minOffset = offset;
      }
    }
    return minOffset;
  };

  // Helper: Check if a buffer position is consumable by all readers
  const isPositionConsumed = (position: number): boolean => {
    const minOffset = getMinReaderOffset();
    return position < minOffset;
  };

  // --- Reader Management ---
  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = readerIdCounter++;
      readerOffsets.set(readerId, readCount); // New reader starts at the latest write position
      activeReaders++;
      return readerId;
    } finally {
      releaseLock();
    }
  };

  const detachReader = (readerId: number): void => {
    const lockPromise = lock();
    lockPromise.then(releaseLock => {
      try {
        const oldOffset = readerOffsets.get(readerId);
        
        if (readerOffsets.delete(readerId)) {
          activeReaders--;
          
          // Check if removing this reader freed up any buffer slots
          if (oldOffset !== undefined) {
            const oldMinOffset = getMinReaderOffset();
            const newMinOffset = getMinReaderOffset();
            
            // If minimum offset has advanced, release write permits
            if (newMinOffset > oldMinOffset) {
              const slotsFreed = Math.min(capacity, newMinOffset - oldMinOffset);
              for (let i = 0; i < slotsFreed; i++) {
                writeSemaphore.release();
              }
            }
          }
        }
      } finally {
        releaseLock();
      }
    });
  };

  // --- Reading Logic ---
  const read = async (readerId: number): Promise<{ value: T | undefined; done: boolean }> => {
    while (true) {
      // First check if we need to wait for data
      const releaseLock = await lock();
      let shouldWait = false;
      let result: { value: T | undefined; done: boolean } | null = null;
      
      try {
        const readerOffset = readerOffsets.get(readerId);
        if (readerOffset === undefined) {
          throw new Error("Reader ID not found.");
        }

        // Check for completion
        if (completed && readerOffset >= readCount) {
          return { value: undefined, done: true };
        }

        // If data is available, consume it
        if (readerOffset < readCount) {
          const readIndex = readerOffset % capacity;
          const value = buffer[readIndex];
          
          // Update reader position
          const oldOffset = readerOffset;
          readerOffsets.set(readerId, readerOffset + 1);
          
          // Check if this position is now completely consumed by all readers
          const positionToCheck = oldOffset;
          if (isPositionConsumed(positionToCheck)) {
            // Release a write slot if this was the last reader to consume this position
            writeSemaphore.release();
          }
          
          result = { value, done: false };
        } else {
          // No data available and not completed - need to wait
          shouldWait = true;
        }
      } finally {
        releaseLock();
      }
      
      // If we have a result, return it
      if (result) {
        return result;
      }
      
      // If the buffer is completed with no more data, return done
      if (completed) {
        return { value: undefined, done: true };
      }
      
      // Wait for new data
      if (shouldWait) {
        await readSemaphore.acquire();
        // After wait, loop back to try reading again
      }
    }
  };

  // --- Completion Handling ---
  const complete = (): void => {
    const lockPromise = lock();
    lockPromise.then(releaseLock => {
      try {
        completed = true;
        // Wake up all waiting readers to check for completion
        for (let i = 0; i < activeReaders; i++) {
          readSemaphore.release();
        }
      } finally {
        releaseLock();
      }
    });
  };

  const isCompleted = (): boolean => {
    return completed;
  };

  return {
    write,
    read,
    attachReader,
    detachReader,
    complete,
    isCompleted,
  };
}
