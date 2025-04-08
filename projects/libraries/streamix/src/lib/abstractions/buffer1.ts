export type ReleaseFn = () => void;
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
  let isCompleted = false;
  let activeReaders = 0;

  // Synchronization primitives
  const lock = createLock();
  const readSemaphore = createSemaphore(0); // Signals data availability
  const writeSemaphore = createSemaphore(capacity); // Tracks free slots
  const allReadersDone = createSemaphore(0); // Signals when all readers have consumed a value

  // --- Writer Logic ---
  const write = async (item: T): Promise<void> => {
    await writeSemaphore.acquire(); // Wait for a free slot
    const releaseLock = await lock();

    try {
      // If there are active readers, wait until they've all consumed the previous value
      if (activeReaders > 0) {
        await allReadersDone.acquire();
      }

      buffer[writeIndex] = item;
      writeIndex = (writeIndex + 1) % capacity;
      readCount++;
      readSemaphore.release(); // Notify readers of new data
    } finally {
      releaseLock();
    }
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

  const detachReader = async (readerId: number): Promise<void> => {
    const releaseLock = await lock();
    try {
      if (readerOffsets.delete(readerId)) {
        activeReaders--;
        // If no readers left, unblock the writer (if waiting)
        if (activeReaders === 0) {
          allReadersDone.release();
        }
      }
    } finally {
      releaseLock();
    }
  };

  // --- Reading Logic ---
  const read = async (readerId: number): Promise<{ value: T | undefined; done: boolean }> => {
    while (true) {
      const releaseLock = await lock();
      try {
        const readerOffset = readerOffsets.get(readerId);
        if (readerOffset === undefined) {
          throw new Error("Reader ID not found.");
        }

        // Check for completion
        if (isCompleted && readerOffset >= readCount) {
          return { value: undefined, done: true };
        }

        // If data is available, consume it
        if (readerOffset < readCount) {
          const readIndex = readerOffset % capacity;
          const value = buffer[readIndex];
          readerOffsets.set(readerId, readerOffset + 1);

          // If this was the last reader to consume this value, notify the writer
          if (isSlowestReader(readerId, readerOffset + 1)) {
            writeSemaphore.release(); // Free a slot
            allReadersDone.release(); // Unblock writer if waiting
          }

          return { value, done: false };
        }
      } finally {
        releaseLock();
      }

      // Wait for new data or completion
      await readSemaphore.acquire();
    }
  };

  // Helper: Checks if a reader is the slowest (last to consume a value)
  const isSlowestReader = (readerId: number, newOffset: number): boolean => {
    for (const [id, offset] of readerOffsets) {
      if (id !== readerId && offset < newOffset) {
        return false;
      }
    }
    return true;
  };

  // --- Completion Handling ---
  const complete = (): void => {
    isCompleted = true;
    readSemaphore.release(); // Wake up any waiting readers
  };

  const isCompleted = (): boolean => isCompleted;

  return {
    write,
    read,
    attachReader,
    detachReader,
    complete,
    isCompleted,
  };
}
