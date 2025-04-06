export type ReleaseFn = () => void;
export type SimpleLock = () => Promise<ReleaseFn>;

export const createLock = (): Lock => {
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

export type Semaphore = (count: number) => {
  acquire: () => Promise<ReleaseFn>;
  tryAcquire: () => ReleaseFn | null;
};

export const createSemaphore: Semaphore = (initialCount) => {
  let count = initialCount;
  const queue: Array<(release: ReleaseFn) => void> = [];

  const acquire = (): Promise<ReleaseFn> => 
    new Promise(resolve => {
      const tryAcquire = () => {
        if (count > 0) {
          count--;
          resolve(() => {
            count++;
            if (queue.length > 0) {
              queue.shift()!()(tryAcquire);
            }
          });
        } else {
          queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });

  const tryAcquire = (): ReleaseFn | null => {
    if (count > 0) {
      count--;
      return () => {
        count++;
        if (queue.length > 0) {
          queue.shift()!()(tryAcquire);
        }
      };
    }
    return null;
  };

  return { acquire, tryAcquire };
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
    const releaseFull = await notFull.acquire();
    const releaseLock = await lock();
    
    buffer[tail] = item;
    tail = (tail + 1) % capacity;
    count++;
    
    releaseLock();
    notEmpty.release();
  };

  const dequeue = async (): Promise<T> => {
    const releaseEmpty = await notEmpty.acquire();
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
