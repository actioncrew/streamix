export function createBuffer<T = any>(capacity: number): Buffer<T> {
  const buffer: T[] = new Array(capacity);
  let writeIndex = 0;
  let readCount = 0;
  const readerOffsets = new Map<number, number>();
  let readerIdCounter = 0;
  let isCompleted = false;
  let activeReaders = 0;

  // Track pending readers for each value
  const pendingReaders = new Map<number, number>(); // value index → remaining readers

  const lock = createLock();
  const readSemaphore = createSemaphore(0);
  const writeSemaphore = createSemaphore(capacity);
  const valueConsumed = createSemaphore(0);

  // --- Writer Logic ---
  const write = async (item: T): Promise<void> => {
    if (isCompleted) throw new Error("Cannot write to completed buffer");

    await writeSemaphore.acquire();
    
    // Wait for previous value to be consumed by all readers (outside lock)
    if (activeReaders > 0 && readCount > 0) {
      const valueIndex = (readCount - 1) % capacity;
      while (true) {
        const releaseLock = await lock();
        let remainingReaders: number;
        try {
          remainingReaders = pendingReaders.get(valueIndex) ?? 0;
          if (remainingReaders === 0) break;
        } finally {
          releaseLock();
        }
        await valueConsumed.acquire();
      }
    }

    const releaseLock = await lock();
    try {
      buffer[writeIndex] = item;
      writeIndex = (writeIndex + 1) % capacity;
      readCount++;

      // Initialize pending readers for this value
      if (activeReaders > 0) {
        pendingReaders.set((readCount - 1) % capacity, activeReaders);
      }

      // Wake up all waiting readers
      for (let i = 0; i < activeReaders; i++) {
        readSemaphore.release();
      }
    } finally {
      releaseLock();
    }
  };

  // --- Reader Management ---
  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = readerIdCounter++;
      readerOffsets.set(readerId, readCount);
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
        // Mark all pending values as partially consumed
        for (const [index, count] of pendingReaders) {
          if (count > 0) {
            pendingReaders.set(index, count - 1);
            if (count === 1) {
              valueConsumed.release();
            }
          }
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
      let result: { value: T | undefined; done: boolean } | null = null;

      try {
        const readerOffset = readerOffsets.get(readerId);
        if (readerOffset === undefined) {
          return { value: undefined, done: true };
        }

        if (isCompleted && readerOffset >= readCount) {
          return { value: undefined, done: true };
        }

        if (readerOffset < readCount) {
          const valueIndex = readerOffset % capacity;
          const value = buffer[valueIndex];
          readerOffsets.set(readerId, readerOffset + 1);

          // Update pending readers count
          const remaining = (pendingReaders.get(valueIndex) ?? 0) - 1;
          pendingReaders.set(valueIndex, remaining);
          if (remaining === 0) {
            valueConsumed.release();
            writeSemaphore.release();
          }

          result = { value, done: false };
        }
      } finally {
        releaseLock();
      }

      if (result) return result;
      if (isCompleted) return { value: undefined, done: true };

      await readSemaphore.acquire();
    }
  };

  // --- Completion Handling ---
  const complete = (): void => {
    const releaseLockPromise = lock();
    releaseLockPromise.then(releaseLock => {
      try {
        isCompleted = true;
        for (let i = 0; i < activeReaders; i++) {
          readSemaphore.release();
        }
      } finally {
        releaseLock();
      }
    });
  };

  return {
    write,
    read,
    attachReader,
    detachReader,
    complete,
    completed: () => isCompleted,
  };
}
