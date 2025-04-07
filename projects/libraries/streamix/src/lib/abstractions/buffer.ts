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
  
  // Track the minimum read position (oldest unread position)
  let minReadPosition = 0;

  const lock = createLock();
  const notFull = createSemaphore(capacity);
  
  // Calculate the minimum read position across all readers
  const updateMinReadPosition = (): void => {
    if (readerPositions.size === 0) {
      // If no readers, all slots are available (matching writeIndex)
      minReadPosition = writeIndex;
      return;
    }
    
    // Find the reader that has read the least (furthest behind)
    let minPos = writeIndex;
    let minDistance = capacity;
    
    for (const pos of readerPositions.values()) {
      // Calculate how far behind this reader is from the write position
      // Consider the cyclic nature of the buffer
      const distance = (writeIndex - pos + capacity) % capacity;
      
      if (distance < minDistance) {
        minDistance = distance;
        minPos = pos;
      }
    }
    
    minReadPosition = minPos;
  };
  
  // Calculate how many free slots are available in the buffer
  const calculateFreeSlots = (): number => {
    if (readerPositions.size === 0) {
      return capacity;
    }
    
    // In a circular buffer, the number of free slots is the distance
    // from the minReadPosition to the writeIndex, minus 1 (we can't write
    // to the exact position that's about to be read)
    return (minReadPosition - writeIndex - 1 + capacity) % capacity;
  };

  const write = async (item: T): Promise<void> => {
    await notFull.acquire();
    const releaseLock = await lock();

    try {
      buffer[writeIndex] = item;
      writeIndex = (writeIndex + 1) % capacity;

      for (const semaphore of readerSemaphores.values()) {
        semaphore.release(); // Notify readers of new data
      }
    } finally {
      releaseLock();
    }
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();

    try {
      const readerId = readerIdCounter++;
      readerPositions.set(readerId, writeIndex); // Start at the current write position
      readerSemaphores.set(readerId, createSemaphore(0)); // Create a semaphore for this reader
      
      // Update the minimum read position
      updateMinReadPosition();
      
      return readerId;
    } finally {
      releaseLock();
    }
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
      const oldMinReadPosition = minReadPosition;
      
      // Update the reader's position
      readerPositions.set(readerId, (readIndex + 1) % capacity);
      
      // Update the minimum read position
      updateMinReadPosition();
      
      // If the minimum read position advanced, release slots in the notFull semaphore
      if (minReadPosition !== oldMinReadPosition) {
        // Calculate how many positions were freed up
        let freedPositions = (minReadPosition - oldMinReadPosition + capacity) % capacity;
        
        // Release that many slots in the notFull semaphore
        for (let i = 0; i < freedPositions; i++) {
          notFull.release();
        }
      }

      return data;
    } finally {
      releaseLock();
    }
  };

  const detachReader = (readerId: number): void => {
    const releaseLockPromise = lock();
    releaseLockPromise.then(releaseLock => {
      try {
        const oldMinReadPosition = minReadPosition;
        
        readerPositions.delete(readerId);
        readerSemaphores.delete(readerId);
        
        // Update the minimum read position after removing this reader
        updateMinReadPosition();
        
        // If the minimum read position advanced, release slots in the notFull semaphore
        if (minReadPosition !== oldMinReadPosition) {
          // Calculate how many positions were freed up
          let freedPositions = (minReadPosition - oldMinReadPosition + capacity) % capacity;
          
          // Release that many slots in the notFull semaphore
          for (let i = 0; i < freedPositions; i++) {
            notFull.release();
          }
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
  };
};
