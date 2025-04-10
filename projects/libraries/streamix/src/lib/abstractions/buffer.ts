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
};

export type Buffer<T = any> = {
  write: (item: T) => Promise<void>;
  read: (readerId: number) => Promise<{ value: T | undefined, done: boolean }>;
  peek: () => T | undefined;
  attachReader: () => Promise<number>;
  detachReader: (readerId: number) => void;
  complete: () => void;
  completed: (readerId: number) => boolean;
};

export function createBuffer<T = any>(
  capacity: number,
): Buffer<T> {
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

    // Only wait if we have active readers and buffer is full
    if (activeReaders > 0 && readCount >= capacity) {
        await writeSemaphore.acquire(); // Will block until readers consume
    }

    const releaseLock = await lock();
    try {
        buffer[writeIndex] = item;
        writeIndex = (writeIndex + 1) % capacity;
        readCount++;

        if (activeReaders > 0) {
            // Track that all active readers need to consume this
            const valueIndex = (readCount - 1) % capacity;
            pendingReaders.set(valueIndex, activeReaders);

            // Notify waiting readers
            for (let i = 0; i < activeReaders; i++) {
                readSemaphore.release();
            }
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
      const startPos = readCount;
      readerOffsets.set(readerId, startPos);
      activeReaders++;

      if (startPos < readCount) {
        readSemaphore.release();
      }

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

  const peek = (): T | undefined => {
    const latestIndex = (writeIndex - 1 + capacity) % capacity;
    return buffer[latestIndex];
  };

  // --- Completion Handling ---
  const complete = (): void => {
    const releaseLockPromise = lock();
    releaseLockPromise.then(releaseLock => {
      try {
        isCompleted = true;
        readSemaphore.release();
      } finally {
        releaseLock();
      }
    });
  };

  return {
    write,
    read,
    peek,
    attachReader,
    detachReader,
    complete,
    completed: () => isCompleted,
  };
}

export function createReplayBuffer<T = any>(
  capacity: number
): Buffer<T> {
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

    // Only wait if we have active readers and buffer is full
    if (activeReaders > 0 && readCount >= capacity) {
        await writeSemaphore.acquire(); // Will block until readers consume
    }

    const releaseLock = await lock();
    try {
        buffer[writeIndex] = item;
        writeIndex = (writeIndex + 1) % capacity;
        readCount++;

        if (activeReaders > 0) {
            // Track that all active readers need to consume this
            const valueIndex = (readCount - 1) % capacity;
            pendingReaders.set(valueIndex, activeReaders);

            // Notify waiting readers
            for (let i = 0; i < activeReaders; i++) {
                readSemaphore.release();
            }
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
      const startPos = Math.max(0, readCount - capacity);
      readerOffsets.set(readerId, startPos);
      activeReaders++;

      if (startPos < readCount) {
        readSemaphore.release();
      }

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

  const peek = (): T | undefined => {
    const latestIndex = (writeIndex - 1 + capacity) % capacity;
    return buffer[latestIndex];
  };

  // --- Completion Handling ---
  const complete = (): void => {
    const releaseLockPromise = lock();
    releaseLockPromise.then(releaseLock => {
      try {
        isCompleted = true;
        readSemaphore.release();
      } finally {
        releaseLock();
      }
    });
  };

  return {
    write,
    read,
    peek,
    attachReader,
    detachReader,
    complete,
    completed: () => isCompleted,
  };
}
