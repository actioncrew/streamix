import { createLock } from "./lock";
import { createSemaphore } from "./semaphore";

/**
 * A concurrent async buffer allowing multiple readers to consume values independently.
 * Each reader sees only new values written after attachment.
 * @template T The type of the values in the buffer.
 */
export type CyclicBuffer<T = any> = {
  /**
   * Writes a new value to the buffer.
   * For single-value buffers, this operation may wait for existing readers to consume the previous value before writing.
   * @param {T} value The value to write.
   * @returns {Promise<void>} A promise that resolves when the write is complete.
   */
  write(value: T): Promise<void>;
  /**
   * Writes an error to the buffer, causing all subsequent reads to throw the error.
   * @param {Error} err The error to write.
   * @returns {Promise<void>} A promise that resolves when the error is recorded.
   */
  error(err: Error): Promise<void>;
  /**
   * Reads the next available value for a specific reader.
   * This operation will wait if no new value is available.
   * @param {number} readerId The ID of the reader.
   * @returns {Promise<IteratorResult<T, void>>} A promise that resolves with the next value or signals completion.
   */
  read(readerId: number): Promise<IteratorResult<T, void>>;
  /**
   * Peeks at the next available value for a specific reader without consuming it.
   * This is a non-blocking check.
   * @param {number} readerId The ID of the reader.
   * @returns {Promise<IteratorResult<T, void>>} A promise that resolves with the next value, an `undefined` value if none is available, or signals completion.
   */
  peek(readerId: number): Promise<IteratorResult<T, void>>;
  /**
   * Completes the buffer, signaling that no more values will be written.
   * All active readers will receive a completion signal after consuming any remaining buffered values.
   * @returns {Promise<void>} A promise that resolves when the completion signal is sent.
   */
  complete(): Promise<void>;
  /**
   * Attaches a new reader to the buffer, starting from the current state.
   * @returns {Promise<number>} A promise that resolves with a unique ID for the new reader.
   */
  attachReader(): Promise<number>;
  /**
   * Detaches a reader from the buffer, cleaning up any associated resources.
   * @param {number} readerId The ID of the reader to detach.
   * @returns {Promise<void>} A promise that resolves when the reader is detached.
   */
  detachReader(readerId: number): Promise<void>;
  /**
   * Checks if a specific reader has reached the end of the buffer.
   * @param {number} readerId The ID of the reader.
   * @returns {boolean} `true` if the reader has completed, `false` otherwise.
   */
  completed(readerId: number): boolean;
};

/**
 * A simplified buffer variant that stores a single value and delivers it to all readers.
 * @template T The type of the value.
 * @extends {CyclicBuffer<T>}
 */
export type SingleValueBuffer<T = any> = CyclicBuffer<T> & {
  /**
   * The current value stored in the buffer.
   * @type {T | undefined}
   */
  get value(): T | undefined;
};

/**
 * Creates a single-value buffer (effectively a buffer with capacity 1).
 * This buffer ensures that a new value can only be written once all currently active readers have consumed the previous value.
 * It provides backpressure by waiting for readers to process the current value before allowing a new one.
 *
 * @template T The type of the value in the buffer.
 * @param {T | undefined} [initialValue=undefined] An optional initial value for the buffer.
 * @returns {SingleValueBuffer<T>} An object representing the single-value buffer.
 */
export function createSingleValueBuffer<T = any>(initialValue?: T): SingleValueBuffer<T> {
  let value: T | undefined = initialValue;
  let error: Error | undefined = undefined;
  let isCompleted = false;
  let hasValue = arguments.length > 0; // Check if initialValue was actually provided
  let version = hasValue ? 1 : 0;

  const readers = new Map<number, {
    lastSeenVersion: number;
    isActive: boolean;
  }>();

  let nextReaderId = 0;
  const waitingReaders: (() => void)[] = [];
  const lock = createLock();

  const notifyReaders = () => {
   if (hasValue && version > 0) {
      let allConsumed = true;
      readers.forEach(reader => {
        if (reader.lastSeenVersion < version) {
          allConsumed = false;
        }
      });

      if (allConsumed) {
        hasValue = false;
        value = undefined;
      }
    }

    const toNotify = [...waitingReaders];
    waitingReaders.length = 0;
    toNotify.forEach(resolve => resolve());
  };

  const write = async (item: T): Promise<void> => {
    const releaseLock = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write to completed buffer");
      if (error) throw new Error("Cannot write after error");

      value = item;
      hasValue = true; // Now we definitely have a value (even if it's undefined for void)
      error = undefined;
      version++;
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  const writeError = async (err: Error): Promise<void> => {
    const releaseLock = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write error to completed buffer");

      error = err;
      hasValue = false; // Error state means no valid value
      value = undefined;
      version++;
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = nextReaderId++;

      // Set lastSeenVersion based on whether we want the reader to get current value
      let initialLastSeenVersion: number;

      if (hasValue || error !== undefined) {
        // There's a current value or error - reader should get it
        // Set to version - 1 so reader will see the current version as "new"
        initialLastSeenVersion = version - 1;
      } else {
        // No current value - reader should wait for next write
        initialLastSeenVersion = version;
      }

      readers.set(readerId, {
        lastSeenVersion: initialLastSeenVersion,
        isActive: true
      });

      // If there's a current value or error, wake up potential readers
      if (hasValue || error !== undefined) {
        notifyReaders();
      }

      return readerId;
    } finally {
      releaseLock();
    }
  };

  const detachReader = async (readerId: number): Promise<void> => {
    const releaseLock = await lock();
    try {
      const reader = readers.get(readerId);
      if (reader) {
        reader.isActive = false;
        readers.delete(readerId);
      }
    } finally {
      releaseLock();
    }
  };

  const read = async (readerId: number): Promise<IteratorResult<T, void>> => {
    while (true) {
      const releaseLock = await lock();
      let result: IteratorResult<T, void> | null = null;

      try {
        const reader = readers.get(readerId);
        if (!reader || !reader.isActive) {
          return { done: true } as IteratorReturnResult<void>;
        }

        // Only return a value if we have one AND the reader hasn't seen this version
        if (hasValue && reader.lastSeenVersion < version) {
          if (error) {
            throw error;
          }

          result = { value: value as T, done: false };
          reader.lastSeenVersion = version;
        } else if (error && reader.lastSeenVersion < version) {
          // Handle error case
          reader.lastSeenVersion = version;
          throw error;
        } else if (isCompleted) {
          return { done: true } as IteratorReturnResult<void>;
        }
      } finally {
        releaseLock();
      }

      if (result) {
        return result;
      }

      // Wait for a new value, error, or completion
      await new Promise<void>(resolve => {
        waitingReaders.push(resolve);
      });
    }
  };

  const peek = async (readerId: number): Promise<IteratorResult<T, void>> => {
    const release = await lock();
    try {
      const reader = readers.get(readerId);
      if (!reader || !reader.isActive) {
        return { done: true } as IteratorReturnResult<void>;
      }

      // Only peek if we have a value and reader hasn't seen this version
      if (hasValue && reader.lastSeenVersion < version) {
        if (error) {
          throw error;
        }

        return { value: value as T, done: false };
      }

      if (isCompleted) {
        return { done: true } as IteratorReturnResult<void>;
      }

      // No new value available to peek
      return { done: true } as IteratorReturnResult<void>;
    } finally {
      release();
    }
  };

  const complete = async (): Promise<void> => {
    const releaseLock = await lock();
    try {
      isCompleted = true;
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  return {
    write,
    error: writeError,
    read,
    peek,
    complete,
    attachReader,
    detachReader,
    completed: (readerId: number) => {
      const reader = readers.get(readerId);
      return !reader || !reader.isActive || (isCompleted && reader.lastSeenVersion >= version);
    },
    get value() {
      return hasValue ? value : undefined;
    }
  };
}

/**
 * A buffer that replays a fixed number of the most recent values to new readers.
 *
 * @template T The type of the values in the buffer.
 * @extends {CyclicBuffer<T>}
 */
export type ReplayBuffer<T = any> = CyclicBuffer<T> & {
  get buffer(): T[];
};

/**
 * Creates a simple asynchronous notifier for coordinating producers and consumers.
 *
 * This utility allows asynchronous code to "wait" for a signal from another part of the
 * application. It is useful for building custom buffers or streams where readers need to
 * pause until new data is available.
 *
 * @returns {{ wait: () => Promise<void>, signal: () => void, signalAll: () => void }} An object with methods to manage the notification state.
 * @property {() => Promise<void>} wait Returns a promise that resolves when a signal is received.
 * @property {() => void} signal Signals the next single waiting promise, unblocking one waiter.
 * @property {() => void} signalAll Signals all waiting promises at once, unblocking all waiters.
 */
export function createNotifier() {
  let waitingResolvers: (() => void)[] = [];
  return {
    wait: () => new Promise<void>(resolve => waitingResolvers.push(resolve)),
    signal: () => waitingResolvers.shift()?.(),
    signalAll: () => { waitingResolvers.forEach(r => r()); waitingResolvers = []; }
  };
}

/**
 * Creates a replay buffer with a specified capacity.
 * This buffer stores a history of values up to its capacity and allows new readers
 * to "replay" past values from the point they attach, up to the current value.
 *
 * If `capacity` is `Infinity`, it acts as an unbounded replay buffer, storing all values.
 * Otherwise, it's a fixed-size circular buffer.
 *
 * @template T The type of the values in the buffer.
 * @param {number} capacity The maximum number of past values to buffer. Use `Infinity` for an unbounded buffer.
 * @returns {ReplayBuffer<T>} An object representing the replay buffer.
 */
export function createReplayBuffer<T = any>(capacity: number): ReplayBuffer<T> {
  const isInfinite = !isFinite(capacity);
  const buffer: (T | { __error: Error })[] = [];

  let writeIndex = 0;
  let totalWritten = 0;
  let nextReaderId = 0;
  let isCompleted = false;
  let hasError = false;

  type ReaderState = { offset: number };
  const readers = new Map<number, ReaderState>();
  const slotCounters = new Map<number, number>();
  const notifier = createNotifier();

  const lock = createLock();
  const semaphore = isInfinite ? undefined : createSemaphore(capacity);

  // Helper: detect error items
  const isErrorItem = (x: any): x is { __error: Error } => x && typeof x === 'object' && '__error' in x;

  // Map absolute index to circular index
  const getIndex = (abs: number) => isInfinite ? abs : abs % capacity;

  // Release a slot when all readers have consumed it
  const releaseSlot = (abs: number) => {
    const cnt = slotCounters.get(abs);
    if (!cnt) return;
    if (cnt <= 1) {
      slotCounters.delete(abs);
      semaphore?.release();
    } else {
      slotCounters.set(abs, cnt - 1);
    }
  };

  // Write internal without locking
  const writeInternal = (item: T | { __error: Error }) => {
    const abs = totalWritten;
    buffer[getIndex(abs)] = item;
    if (!isInfinite) writeIndex = (writeIndex + 1) % capacity;
    totalWritten++;
    if (readers.size > 0) slotCounters.set(abs, readers.size);
    notifier.signalAll();
  };

  // Public write
  async function write(value: T): Promise<void> {
    const release = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write to completed buffer");
      if (hasError) throw new Error("Cannot write after error");
      if (!isInfinite && totalWritten >= capacity && readers.size > 0) {
        await semaphore!.acquire();
      }
      writeInternal(value);
    } finally {
      release();
    }
  }

  // Public error
  async function error(err: Error): Promise<void> {
    const release = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write error to completed buffer");
      hasError = true;
      writeInternal({ __error: err });
    } finally {
      release();
    }
  }

  // Attach a new reader
  async function attachReader(): Promise<number> {
    const release = await lock();
    try {
      const id = nextReaderId++;
      const start = Math.max(0, totalWritten - (isInfinite ? totalWritten : capacity));
      readers.set(id, { offset: start });
      return id;
    } finally {
      release();
    }
  }

  // Detach a reader, releasing its slots
  async function detachReader(id: number): Promise<void> {
    const release = await lock();
    try {
      const st = readers.get(id);
      if (!st) return;
      const { offset } = st;
      readers.delete(id);
      for (let i = offset; i < totalWritten; i++) releaseSlot(i);
      notifier.signalAll();
    } finally {
      release();
    }
  }

  // Read next value for reader
  async function read(id: number): Promise<IteratorResult<T, void>> {
    while (true) {
      const release = await lock();
      const st = readers.get(id);
      if (!st) { release(); return { value: undefined, done: true }; }
      const off = st.offset;
      if (off < totalWritten) {
        const item = buffer[getIndex(off)];
        st.offset++;
        release();
        if (isErrorItem(item)) throw item.__error;
        releaseSlot(off);
        return { value: item as T, done: false };
      }
      if (isCompleted) { release(); return { value: undefined, done: true }; }
      release();
      await notifier.wait();
    }
  }

  // Complete buffer
  async function complete(): Promise<void> {
    const release = await lock();
    try {
      isCompleted = true;
      notifier.signalAll();
      semaphore?.release();
    } finally {
      release();
    }
  }

  // Peek latest
  const peek = async function(id: number): Promise<IteratorResult<T>> {
    const release = await lock();
    try {
      const st = readers.get(id);

      // Check if reader is detached
      if (!st) {
        return { value: undefined as any, done: true };
      }

      // Check if no data available to peek
      if (totalWritten === 0 || st.offset >= totalWritten) {
        return { value: undefined as any, done: true };
      }

      const readPos = st.offset;
      const idx = isInfinite ? readPos : readPos % capacity;
      const item = buffer[idx];

      if (isErrorItem(item)) {
        return Promise.reject(item) as any;
      }

      return { value: item as T, done: false };
    } finally {
      release();
    }
  };

  // Check completed for reader
  function completed(id: number): boolean {
    const st = readers.get(id);
    return !st || (isCompleted && st.offset >= totalWritten);
  }

  // Snapshot
  function getBuffer(): T[] {
    const res: T[] = [];
    const start = Math.max(0, totalWritten - (isInfinite ? totalWritten : capacity));
    for (let i = start; i < totalWritten; i++) {
      const item = buffer[getIndex(i)];
      if (!isErrorItem(item)) res.push(item as T);
    }
    return res;
  }

  return {
    write,
    error,
    read,
    peek,
    attachReader,
    detachReader,
    complete,
    completed,
    get buffer() { return getBuffer(); }
  };
}
