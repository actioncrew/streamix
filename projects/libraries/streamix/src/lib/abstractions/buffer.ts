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
  let pendingCount = 0;

  const enqueue = (operation: () => Promise<any>): Promise<any> => {
    pendingCount++;

    const result = last
      .then(() => operation())
      .finally(() => {
        pendingCount--;

        // Reset the call stack when queue is empty
        if (pendingCount === 0) {
          last = Promise.resolve();
        }
      });

    // Chain the next operation but handle errors to prevent queue lock
    last = result.catch(() => {});

    return result;
  };

  return {
    enqueue,
    // Utility methods for debugging/monitoring
    get pending() { return pendingCount; },
    get isEmpty() { return pendingCount === 0; }
  };
}

export type CyclicBuffer<T = any> = {
  write: (item: T) => Promise<void>;
  read: (readerId: number) => Promise<{ value: T | undefined, done: boolean }>;
  peek: () => Promise<T | undefined>;
  attachReader: () => Promise<number>;
  detachReader: (readerId: number) => Promise<void>;
  complete: () => Promise<void>;
  completed: (readerId: number) => boolean;
};

export type SingleValueBuffer<T = any> = CyclicBuffer<T> & { get value(): T | undefined; };

export function createSingleValueBuffer<T = any>(initialValue: T | undefined = undefined): SingleValueBuffer<T> {
  let value: T | undefined = initialValue;
  let hasValue = initialValue === undefined ? false : true;
  let readCount = hasValue ? 1 : 0;
  const readerOffsets = new Map<number, number>();
  let readerIdCounter = 0;
  let isCompleted = false;
  let activeReaders = 0;

  const pendingReaders = new Map<number, number>(); // single entry: index 0 → readers left

  const lock = createLock();
  const readSemaphore = createSemaphore(0);
  const writeSemaphore = createSemaphore(1); // always 1 for capacity=1
  const valueConsumed = createSemaphore(0);

  // --- Writer Logic ---
  const write = async (item: T): Promise<void> => {
    if (isCompleted) throw new Error("Cannot write to completed buffer");

    if (activeReaders > 0 && hasValue) {
      await writeSemaphore.acquire(); // wait until current value is consumed
    }

    const releaseLock = await lock();
    try {
      value = item;
      hasValue = true;
      readCount++;

      if (activeReaders > 0) {
        pendingReaders.set(0, activeReaders);
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
      const startPos = hasValue ? readCount - 1 : readCount;
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
        const remaining = (pendingReaders.get(0) ?? 0) - 1;
        if (remaining > 0) {
          pendingReaders.set(0, remaining);
        } else if (remaining === 0) {
          pendingReaders.delete(0);
          hasValue = false;
          value = undefined;
          valueConsumed.release();
          writeSemaphore.release();
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

        if (readerOffset < readCount && hasValue) {
          const readValue = value;
          readerOffsets.set(readerId, readerOffset + 1);

          const remaining = (pendingReaders.get(0) ?? 0) - 1;
          if (remaining > 0) {
            pendingReaders.set(0, remaining);
          } else if (remaining === 0) {
            pendingReaders.delete(0);
            hasValue = false;
            value = undefined;
            valueConsumed.release();
            writeSemaphore.release();
          }

          result = { value: readValue, done: false };
        }
      } finally {
        releaseLock();
      }

      if (result) return result;
      if (isCompleted) return { value: undefined, done: true };

      await readSemaphore.acquire();
    }
  };

  const peek = async (): Promise<T | undefined> => {
    const releaseLock = await lock();
    try {
      return hasValue ? value : undefined;
    } finally {
      releaseLock();
    }
  };

  const complete = async (): Promise<void> => {
    const releaseLock = await lock();
    try {
      isCompleted = true;
      readSemaphore.release();
    } finally {
      releaseLock();
    }
  };

  return {
    write,
    read,
    peek,
    attachReader,
    detachReader,
    complete,
    completed: () => isCompleted,
    get value() {
      return hasValue ? value : undefined;
    },
  } as SingleValueBuffer<T>;
}

export function createCyclicBuffer<T = any>(
  capacity: number,
): CyclicBuffer<T> {
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

  const peek = async (): Promise<T | undefined> => {
    const releaseLock = await lock();
    try {
      if (readCount === 0) return undefined;
      const latestIndex = (writeIndex - 1 + capacity) % capacity;
      return buffer[latestIndex];
    } finally {
      releaseLock();
    }
  };

  // --- Completion Handling ---
  const complete = async(): Promise<void> => {
    const releaseLock = await lock();
    try {
      isCompleted = true;
      readSemaphore.release();
    } finally {
      releaseLock();
    }
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
};

export function createReplayBuffer<T = any>(
  capacity: number
): CyclicBuffer<T> {
  const isInfinite = capacity === Infinity;

  const buffer: T[] = [];
  let writeIndex = 0;
  let readCount = 0;
  const readerOffsets = new Map<number, number>();
  let readerIdCounter = 0;
  let isCompleted = false;
  let activeReaders = 0;

  const pendingReaders = new Map<number, number>();

  const lock = createLock();
  const readSemaphore = createSemaphore(0);
  const writeSemaphore = isInfinite ? undefined : createSemaphore(capacity);
  const valueConsumed = createSemaphore(0);

  const write = async (item: T): Promise<void> => {
    if (isCompleted) throw new Error("Cannot write to completed buffer");

    if (!isInfinite && activeReaders > 0 && readCount >= capacity) {
      await writeSemaphore!.acquire();
    }

    const releaseLock = await lock();
    try {
      if (isInfinite) {
        buffer.push(item);
      } else {
        buffer[writeIndex] = item;
        writeIndex = (writeIndex + 1) % capacity;
      }

      readCount++;

      if (activeReaders > 0) {
        const valueIndex = isInfinite ? readCount - 1 : (readCount - 1) % capacity;
        pendingReaders.set(valueIndex, activeReaders);

        for (let i = 0; i < activeReaders; i++) {
          readSemaphore.release();
        }
      }
    } finally {
      releaseLock();
    }
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = readerIdCounter++;
      const startPos = Math.max(0, readCount - (isInfinite ? readCount : capacity));
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
        for (const [index, count] of pendingReaders) {
          if (count > 0) {
            pendingReaders.set(index, count - 1);
            if (count === 1 && !isInfinite) {
              valueConsumed.release();
            }
          }
        }
      }
    } finally {
      releaseLock();
    }
  };

  const read = async (readerId: number): Promise<{ value: T | undefined; done: boolean }> => {
    while (true) {
      const releaseLock = await lock();
      let result: { value: T | undefined; done: boolean } | null = null;

      try {
        const readerOffset = readerOffsets.get(readerId);
        if (readerOffset === undefined) {
          return { value: undefined, done: true };
        }

        // Check if there are buffered values to replay, even if completed
        if (readerOffset < readCount) {
          const valueIndex = isInfinite ? readerOffset : readerOffset % capacity;
          const value = buffer[valueIndex];
          readerOffsets.set(readerId, readerOffset + 1);

          const remaining = (pendingReaders.get(valueIndex) ?? 0) - 1;
          pendingReaders.set(valueIndex, remaining);
          if (remaining === 0 && !isInfinite) {
            valueConsumed.release();
            writeSemaphore!.release();
          }

          result = { value, done: false };
        } else if (isCompleted) {
          // If completed and no more values, return done
          return { value: undefined, done: true };
        }
      } finally {
        releaseLock();
      }

      if (result) return result;
      if (isCompleted) return { value: undefined, done: true };

      await readSemaphore.acquire();
    }
  };

  const peek = async (): Promise<T | undefined> => {
    const releaseLock = await lock();
    try {
      if (readCount === 0) return undefined;
      const latestIndex = isInfinite
        ? buffer.length - 1
        : (writeIndex - 1 + capacity) % capacity;
      return buffer[latestIndex];
    } finally {
      releaseLock();
    }
  };

  const complete = async (): Promise<void> => {
    const releaseLock = await lock();
    try {
      isCompleted = true;
      readSemaphore.release();
    } finally {
      releaseLock();
    }
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
};
