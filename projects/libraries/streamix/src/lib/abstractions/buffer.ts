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
  enqueue: (item: T) => Promise<void>;
  dequeue: () => Promise<T>;
  isEmpty: () => boolean;
  isFull: () => boolean;
};

export const createBuffer = <T>(capacity: number): Buffer<T> => {
  const buffer: Array<T> = new Array(capacity);
  let head = 0;
  let tail = 0;
  let count = 0;
  const lock = createLock();
  const notEmpty = createSemaphore(0);
  const notFull = createSemaphore(capacity);

  const enqueue = async (item: T) => {
    await notFull.acquire();
    const releaseLock = await lock();
    
    buffer[tail] = item;
    tail = (tail + 1) % capacity;
    count++;
    
    releaseLock();
    notEmpty.release();
  };

  const dequeue = async (): Promise<T> => {
    await notEmpty.acquire();
    const releaseLock = await lock();
    
    const item = buffer[head];
    head = (head + 1) % capacity;
    count--;
    
    releaseLock();
    notFull.release();
    return item;
  };

  return {
    enqueue,
    dequeue,
    isEmpty: () => count === 0,
    isFull: () => count === capacity
  };
};
