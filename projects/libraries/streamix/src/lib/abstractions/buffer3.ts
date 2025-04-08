export function createBuffer<T = any>(capacity: number): Buffer<T> {
  if (capacity < 1) throw new Error("Capacity must be at least 1");

  const buffer: T[] = new Array(capacity);
  let writeIndex = 0;
  let readCount = 0;
  const readerOffsets = new Map<number, number>();
  let readerIdCounter = 0;
  let completed = false;
  let activeReaders = 0;
  let slowestReaderOffset = 0; // Tracks the slowest reader's position

  const lock = createLock();
  const readSemaphore = createSemaphore(0);
  const writeSemaphore = createSemaphore(capacity);

  // --- Writer Logic ---
  const write = async (item: T): Promise<void> => {
    if (completed) throw new Error("Cannot write to completed buffer");

    await writeSemaphore.acquire();
    const releaseLock = await lock();

    try {
      buffer[writeIndex] = item;
      writeIndex = (writeIndex + 1) % capacity;
      readCount++;

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
        updateSlowestReader();
      }
    } finally {
      releaseLock();
    }
  };

  // --- Slowest Reader Tracking ---
  const updateSlowestReader = (): void => {
    let minOffset = readCount;
    for (const offset of readerOffsets.values()) {
      if (offset < minOffset) minOffset = offset;
    }
    slowestReaderOffset = minOffset;

    // Release write slots if readers have consumed data
    const consumedSlots = slowestReaderOffset - (readCount - capacity);
    if (consumedSlots > 0) {
      for (let i = 0; i < consumedSlots; i++) {
        writeSemaphore.release();
      }
    }
  };

  // --- Reading Logic ---
  const read = async (readerId: number): Promise<{ value: T | undefined; done: boolean }> => {
    while (true) {
      const releaseLock = await lock();
      let result: { value: T | undefined; done: boolean } | null = null;

      try {
        const readerOffset = readerOffsets.get(readerId);
        if (readerOffset === undefined) throw new Error("Reader ID not found");

        if (completed && readerOffset >= readCount) {
          return { value: undefined, done: true };
        }

        if (readerOffset < readCount) {
          const value = buffer[readerOffset % capacity];
          readerOffsets.set(readerId, readerOffset + 1);
          updateSlowestReader();
          result = { value, done: false };
        }
      } finally {
        releaseLock();
      }

      if (result) return result;
      if (completed) return { value: undefined, done: true };

      await readSemaphore.acquire();
    }
  };

  // --- Completion Handling ---
  const complete = (): void => {
    const releaseLockPromise = lock();
    releaseLockPromise.then(releaseLock => {
      try {
        completed = true;
        for (let i = 0; i < activeReaders; i++) {
          readSemaphore.release();
        }
      } finally {
        releaseLock();
      }
    });
  };

  const isCompleted = (): boolean => completed;

  return {
    write,
    read,
    attachReader,
    detachReader,
    complete,
    isCompleted,
  };
}
