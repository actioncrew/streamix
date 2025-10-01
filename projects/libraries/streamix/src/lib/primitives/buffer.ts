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
export type SubjectBuffer<T = any> = CyclicBuffer<T> & {
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
 * @returns {SubjectBuffer<T>} An object representing the single-value buffer.
 */
export function createSubjectBuffer<T = any>(): CyclicBuffer<T> {
  let isCompleted = false;
  let hasError = false;

  // Unified buffer storing both values and errors
  const buffer: (T | { __error: Error })[] = [];

  const readers = new Map<number, {
    readIndex: number;
    isActive: boolean;
  }>();

  let nextReaderId = 0;
  const waitingReaders: (() => void)[] = [];
  const lock = createLock();

  // Helper: detect error items
  const isErrorItem = (x: any): x is { __error: Error } => 
    x && typeof x === 'object' && '__error' in x;

  const notifyReaders = () => {
    const toNotify = [...waitingReaders];
    waitingReaders.length = 0;
    toNotify.forEach(resolve => resolve());
  };

  const write = async (item: T): Promise<void> => {
    const releaseLock = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write to completed buffer");
      if (hasError) throw new Error("Cannot write after error");

      buffer.push(item);
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  const writeError = async (err: Error): Promise<void> => {
    const releaseLock = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write error to completed buffer");

      buffer.push({ __error: err });
      hasError = true;
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = nextReaderId++;

      // Subject semantics: start from current position (miss any existing values)
      readers.set(readerId, {
        readIndex: buffer.length, // Start reading from next value
        isActive: true
      });

      return readerId;
    } finally {
      releaseLock();
    }
  };

  const detachReader = async (readerId: number): Promise<void> => {
    const releaseLock = await lock();
    try {
      readers.delete(readerId);
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
          return { done: true, value: undefined } as IteratorResult<T>;
        }

        // Check if there's an item to read
        if (reader.readIndex < buffer.length) {
          const item = buffer[reader.readIndex];
          reader.readIndex++;
          
          if (isErrorItem(item)) {
            throw item.__error;
          }
          
          result = { value: item as T, done: false };
        }
        // Check if completed (only after all items are read)
        else if (isCompleted && reader.readIndex >= buffer.length) {
          return { done: true, value: undefined } as IteratorResult<T>;
        }
      } finally {
        releaseLock();
      }

      if (result) {
        return result;
      }

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
        return { done: true, value: undefined } as IteratorResult<T>;
      }

      // Check if there's an item to peek
      if (reader.readIndex < buffer.length) {
        const item = buffer[reader.readIndex];
        
        if (isErrorItem(item)) {
          throw item.__error;
        }
        
        return { value: item as T, done: false };
      }

      if (isCompleted && reader.readIndex >= buffer.length) {
        return { done: true, value: undefined } as IteratorResult<T>;
      }

      return { value: undefined as T, done: false };
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
      if (!reader || !reader.isActive) return true;
      
      const allItemsRead = reader.readIndex >= buffer.length;
      return allItemsRead && (isCompleted || hasError);
    }
  };
}
/**
 * Creates a BehaviorSubject-like buffer.
 *
 * This implementation wraps an underlying SubjectBuffer to provide the specific behavior
 * of a BehaviorSubject: it holds a current value and emits that value immediately
 * to any new reader upon attachment.
 *
 * @template T The type of the value the buffer will hold.
 * @param {T} [initialValue] The optional initial value to hold upon creation.
 * @returns {SubjectBuffer<T>} A new SingleValueBuffer instance.
 */
export function createBehaviorSubjectBuffer<T = any>(initialValue?: T): SubjectBuffer<T> {
  const subject = createSubjectBuffer<T>();
  let currentValue: T | { __error: Error } | undefined = initialValue;
  let hasCurrentValue = arguments.length > 0;

  // Track which readers need to receive the initial value
  const behaviorReaders = new Map<number, boolean>(); // readerId -> hasReceivedInitialValue
  
  // Track completion state locally
  let isCompleted = false;
  
  const lock = createLock();

  // Helper: detect error items
  const isErrorItem = (x: any): x is { __error: Error } => 
    x && typeof x === 'object' && '__error' in x;

  return {
    async write(value: T): Promise<void> {
      const release = await lock();
      try {
        if (isCompleted) throw new Error("Cannot write to completed buffer");
        
        currentValue = value;
        hasCurrentValue = true;
        await subject.write(value);
      } finally {
        release();
      }
    },

    async error(err: Error): Promise<void> {
      const release = await lock();
      try {
        if (isCompleted) throw new Error("Cannot error a completed buffer");
        
        // Store error as current value (wrapped) and write to buffer
        const errorItem = { __error: err };
        currentValue = errorItem;
        hasCurrentValue = true;
        await subject.error(err);
      } finally {
        release();
      }
    },

    async attachReader(): Promise<number> {
      const release = await lock();
      try {
        const readerId = await subject.attachReader();

        // BehaviorSubject semantics: track if reader needs initial value
        if (hasCurrentValue) {
          behaviorReaders.set(readerId, false); // hasn't received initial value yet
        } else {
          behaviorReaders.set(readerId, true); // no initial value to receive
        }

        return readerId;
      } finally {
        release();
      }
    },
    
    async detachReader(readerId: number): Promise<void> {
      const release = await lock();
      try {
        behaviorReaders.delete(readerId);
        await subject.detachReader(readerId);
      } finally {
        release();
      }
    },

    async read(readerId: number): Promise<IteratorResult<T, void>> {
      const release = await lock();
      try {
        if (isCompleted) {
          return { value: undefined, done: true };
        }
        
        // Check if this reader needs to receive the initial/current value first
        const needsInitial = behaviorReaders.get(readerId) === false;

        if (needsInitial && hasCurrentValue) {
          // Mark that this reader has now received the initial value
          behaviorReaders.set(readerId, true);
          
          // If current value is an error, throw it
          if (isErrorItem(currentValue)) {
            throw currentValue.__error;
          }
          
          return { value: currentValue as T, done: false };
        }
      } finally {
        release();
      }

      // Otherwise, delegate to the underlying subject
      // (which will handle errors in the buffer and throw them)
      return await subject.read(readerId);
    },

    async peek(readerId: number): Promise<IteratorResult<T, void>> {
      const release = await lock();
      try {
        // Check if reader needs initial value
        const needsInitial = behaviorReaders.get(readerId) === false;
        
        if (needsInitial && hasCurrentValue) {
          // Don't mark as received for peek - it's non-consuming
          if (isErrorItem(currentValue)) {
            throw currentValue.__error;
          }
          return { value: currentValue as T, done: false };
        }

        // If reader has received initial value or no initial value exists,
        // check if there's a current value to peek
        if (hasCurrentValue && behaviorReaders.has(readerId)) {
          if (isErrorItem(currentValue)) {
            throw currentValue.__error;
          }
          return { value: currentValue as T, done: false };
        }
      } finally {
        release();
      }

      return await subject.peek(readerId);
    },

    async complete(): Promise<void> {
      const release = await lock();
      try {
        isCompleted = true;
        await subject.complete();
      } finally {
        release();
      }
    },

    completed(readerId: number): boolean {
      if (isCompleted) {
        return true;
      }
      return subject.completed(readerId);
    },

    get value(): T | undefined {
      if (!hasCurrentValue) return undefined;
      if (isErrorItem(currentValue)) return undefined;
      return currentValue as T;
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
        throw item.__error;
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
