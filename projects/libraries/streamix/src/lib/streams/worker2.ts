import { eachValueFrom } from '@actioncrew/streamix';
import { createOperator, createStream, Operator, Stream } from "../abstractions";
import { Coroutine } from "../operators/coroutine";

export interface InteractiveWorker extends Worker {
  id: string;
  messageId: number;
  pendingRequests: Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timeout?: ReturnType<typeof setTimeout>;
    }
  >;
}

export interface WorkerMessage<T = any> {
  id: number;
  type: 'request' | 'response' | 'error' | 'stream' | 'ping' | 'pong' | 'complete';
  payload: T;
  error?: string;
}

export interface WorkerConfig {
  timeout?: number;
  keepAlive?: boolean;
  maxRetries?: number;
  pingInterval?: number;
  retryDelay?: number;
  workerFactory?: () => Worker | Promise<Worker>;
}

export interface WorkerChannel<TIn = any, TOut = any> extends Stream<TOut> {
  send: (data: TIn) => Promise<void>;
  request: (data: TIn, timeout?: number) => Promise<TOut>;
  close: () => Promise<void>;
  workerId: string;
  isClosed: boolean;
}

export function workerChannel<TIn = any, TOut = any>(
  task: Coroutine | Worker | (() => Worker | Promise<Worker>),
  config: WorkerConfig = {}
): WorkerChannel<TIn, TOut> {
  const {
    timeout = 30000,
    keepAlive = true,
    pingInterval = 5000,
    maxRetries = 3,
    retryDelay = 1000,
  } = config;

  let worker: InteractiveWorker | null = null;
  let closed = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let retryCount = 0;

  // For async iterator streaming
  const streamMessageQueue: Array<TOut> = [];
  let streamMessageResolvers: Array<(value: IteratorResult<TOut>) => void> = [];
  let streamComplete = false;

  const initWorker = async (): Promise<InteractiveWorker> => {
    if (worker && !closed) return worker;

    let baseWorker: Worker;

    if (task instanceof Worker) {
      baseWorker = task;
    } else if (typeof task === 'function') {
      baseWorker = await task();
    } else {
      baseWorker = await task.getIdleWorker();
    }

    worker = Object.assign(baseWorker, {
      id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      messageId: 0,
      pendingRequests: new Map(),
    }) as InteractiveWorker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'response':
        case 'error':
          const pending = worker!.pendingRequests.get(msg.id);
          if (pending) {
            if (pending.timeout) clearTimeout(pending.timeout);
            worker!.pendingRequests.delete(msg.id);
            if (msg.type === 'error') {
              pending.reject(new Error(msg.error || 'Worker error'));
            } else {
              pending.resolve(msg.payload);
            }
          }
          break;

        case 'stream':
          if (streamMessageResolvers.length > 0) {
            const resolve = streamMessageResolvers.shift()!;
            resolve({ done: false, value: msg.payload });
          } else {
            streamMessageQueue.push(msg.payload);
          }
          break;

        case 'complete':
          streamComplete = true;
          // Resolve any pending stream reads as done
          while (streamMessageResolvers.length > 0) {
            const resolve = streamMessageResolvers.shift()!;
            resolve({ done: true, value: undefined });
          }
          break;

        case 'pong':
          // Reset retry count on successful pong
          retryCount = 0;
          break;
      }
    };

    worker.onerror = (error: ErrorEvent) => {
      console.error('Worker error:', error);
      cleanupWorker(error.message);
    };

    worker.onmessageerror = (event: MessageEvent) => {
      console.error('Worker message error:', event);
      cleanupWorker('Message error');
    };

    if (keepAlive && pingInterval > 0) {
      pingTimer = setInterval(async () => {
        if (worker && !closed) {
          try {
            const pingMsg: WorkerMessage = {
              id: ++worker.messageId,
              type: 'ping',
              payload: Date.now(),
            };
            worker.postMessage(pingMsg);

            // If we haven't received a pong after timeout, consider the worker dead
            await new Promise((_, reject) => {
              setTimeout(() => {
                if (worker?.pendingRequests.has(pingMsg.id)) {
                  reject(new Error('Ping timeout'));
                }
              }, timeout);
            });
          } catch (error) {
            retryCount++;
            if (retryCount >= maxRetries) {
              cleanupWorker('Max ping retries exceeded');
            } else {
              // Try to reinitialize the worker after delay
              setTimeout(() => {
                if (!closed) initWorker().catch(err => cleanupWorker(err.message));
              }, retryDelay);
            }
          }
        }
      }, pingInterval);
    }

    return worker;
  };

  const cleanupWorker = (errorMessage: string) => {
    if (!worker) return;

    // Reject all pending requests
    worker.pendingRequests.forEach(({ reject, timeout }) => {
      if (timeout) clearTimeout(timeout);
      reject(new Error(errorMessage));
    });
    worker.pendingRequests.clear();

    // Resolve all pending stream reads as done
    streamMessageResolvers.forEach(resolve =>
      resolve({ done: true, value: undefined })
    );
    streamMessageResolvers = [];

    if (keepAlive && typeof task !== 'function' && !(task instanceof Worker)) {
      task.returnWorker(worker);
    } else {
      worker.terminate();
    }

    worker = null;
  };

  const send = async (data: TIn): Promise<void> => {
    if (closed) throw new Error('Channel is closed');

    const w = await initWorker();
    const message: WorkerMessage<TIn> = {
      id: ++w.messageId,
      type: 'stream',
      payload: data,
    };
    w.postMessage(message);
  };

  const request = async (data: TIn, requestTimeout = timeout): Promise<TOut> => {
    if (closed) throw new Error('Channel is closed');

    const w = await initWorker();
    const id = ++w.messageId;

    return new Promise<TOut>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        w.pendingRequests.delete(id);
        reject(new Error(`Worker request timeout after ${requestTimeout}ms`));
      }, requestTimeout);

      w.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      const message: WorkerMessage<TIn> = {
        id,
        type: 'request',
        payload: data,
      };
      w.postMessage(message);
    });
  };

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;

    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }

    if (worker) {
      // Notify worker we're closing
      const closeMessage: WorkerMessage = {
        id: ++worker.messageId,
        type: 'complete',
        payload: null,
      };
      worker.postMessage(closeMessage);

      cleanupWorker('Channel closed by client');
    }
  };

  const stream = createStream<TOut>('workerChannel', async function* () {
    await initWorker();

    try {
      while (!closed && !streamComplete) {
        if (streamMessageQueue.length > 0) {
          yield streamMessageQueue.shift()!;
        } else {
          const value = await new Promise<IteratorResult<TOut>>((resolve) => {
            streamMessageResolvers.push(resolve);
          });
          if (value.done) break;
          yield value.value;
        }
      }
    } finally {
      await close();
    }
  });

  return Object.assign(stream, {
    send,
    request,
    close,
    get workerId() { return worker?.id || ''; },
    get isClosed() { return closed; }
  }) as WorkerChannel<TIn, TOut>;
}

/**
 * Operator that sends each stream value to a worker and yields the response
 */
export function workerMap<T, R>(
  task: Coroutine | Worker | (() => Worker | Promise<Worker>),
  config: WorkerConfig = {}
): Operator<T, R> {
  return createOperator<T, R>("workerMap", (source) => {
    let channel: WorkerChannel<T, R> | null = null;

    return {
      async next(): Promise<IteratorResult<R>> {
        const { done, value } = await source.next();
        if (done) {
          if (channel) await channel.close();
          return { done: true, value: undefined };
        }

        if (!channel) {
          channel = workerChannel<T, R>(task, config);
        }

        try {
          const result = await channel.request(value);
          return { done: false, value: result };
        } catch (error) {
          if (channel) await channel.close();
          throw error;
        }
      },

      async return(): Promise<IteratorResult<R>> {
        if (channel) await channel.close();
        return { done: true, value: undefined };
      },

      async throw(error?: any): Promise<IteratorResult<R>> {
        if (channel) await channel.close();
        throw error;
      }
    };
  });
}

/**
 * Operator that broadcasts each stream value to a worker without waiting for response
 */
export function workerBroadcast<T>(
  task: Coroutine | Worker | (() => Worker | Promise<Worker>),
  config: WorkerConfig = {}
): Operator<T, T> {
  return createOperator<T, T>("workerBroadcast", (source) => {
    let channel: WorkerChannel<T, any> | null = null;

    return {
      async next(): Promise<IteratorResult<T>> {
        const { done, value } = await source.next();
        if (done) {
          if (channel) await channel.close();
          return { done: true, value: undefined };
        }

        if (!channel) {
          channel = workerChannel<T, any>(task, config);
        }

        try {
          await channel.send(value);
          return { done: false, value };
        } catch (error) {
          if (channel) await channel.close();
          throw error;
        }
      },

      async return(): Promise<IteratorResult<T>> {
        if (channel) await channel.close();
        return { done: true, value: undefined };
      },

      async throw(error?: any): Promise<IteratorResult<T>> {
        if (channel) await channel.close();
        throw error;
      }
    };
  });
}

/**
 * Creates a duplex stream that merges worker responses with the original stream
 */
export function workerDuplex<TIn, TOut>(
  task: Coroutine | Worker | (() => Worker | Promise<Worker>),
  config: WorkerConfig = {}
): Operator<TIn, TIn | TOut> {
  return createOperator<TIn, TIn | TOut>("workerDuplex", (source) => {
    let channel: WorkerChannel<TIn, TOut> | null = null;
    let workerIterator: AsyncIterator<TOut> | null = null;
    let sourceComplete = false;
    let workerComplete = false;

    const initChannel = async () => {
      if (!channel) {
        channel = workerChannel<TIn, TOut>(task, config);
        workerIterator = eachValueFrom(channel);
      }
    };

    return {
      async next(): Promise<IteratorResult<TIn | TOut>> {
        await initChannel();

        // If both streams are complete, we're done
        if (sourceComplete && workerComplete) {
          return { done: true, value: undefined };
        }

        // Try to get next value from source
        if (!sourceComplete) {
          const sourceResult = await source.next();
          if (sourceResult.done) {
            sourceComplete = true;
          } else {
            // Send to worker and return original value
            await channel!.send(sourceResult.value);
            return { done: false, value: sourceResult.value };
          }
        }

        // Try to get next value from worker
        if (!workerComplete && workerIterator) {
          try {
            const workerResult = await workerIterator.next();
            if (workerResult.done) {
              workerComplete = true;
            } else {
              return { done: false, value: workerResult.value };
            }
          } catch {
            workerComplete = true;
          }
        }

        // If we get here, both streams are complete
        if (channel) await channel.close();
        return { done: true, value: undefined };
      },

      async return(): Promise<IteratorResult<TIn | TOut>> {
        if (channel) await channel.close();
        return { done: true, value: undefined };
      },

      async throw(error?: any): Promise<IteratorResult<TIn | TOut>> {
        if (channel) await channel.close();
        throw error;
      }
    };
  });
}

/**
 * Creates a worker pool that distributes work across multiple workers
 */
export function workerPool<TIn, TOut>(
  workerCount: number,
  workerFactory: () => Worker | Promise<Worker>,
  config: WorkerConfig = {}
): Operator<TIn, TOut> {
  return createOperator<TIn, TOut>("workerPool", (source) => {
    const channels: WorkerChannel<TIn, TOut>[] = [];
    let currentWorkerIndex = 0;

    // Initialize worker pool
    for (let i = 0; i < workerCount; i++) {
      channels.push(workerChannel<TIn, TOut>(workerFactory, config));
    }

    return {
      async next(): Promise<IteratorResult<TOut>> {
        const { done, value } = await source.next();
        if (done) {
          await Promise.all(channels.map(ch => ch.close()));
          return { done: true, value: undefined };
        }

        // Round-robin distribution
        const channel = channels[currentWorkerIndex];
        currentWorkerIndex = (currentWorkerIndex + 1) % channels.length;

        try {
          const result = await channel.request(value);
          return { done: false, value: result };
        } catch (error) {
          await Promise.all(channels.map(ch => ch.close()));
          throw error;
        }
      },

      async return(): Promise<IteratorResult<TOut>> {
        await Promise.all(channels.map(ch => ch.close()));
        return { done: true, value: undefined };
      },

      async throw(error?: any): Promise<IteratorResult<TOut>> {
        await Promise.all(channels.map(ch => ch.close()));
        throw error;
      }
    };
  });
}

/**
 * Helper function to create worker scripts that handle the extended message protocol
 */
export function createWorkerScript(handlers: {
  onRequest?: (data: any) => Promise<any> | any;
  onStream?: (data: any) => Promise<void> | void;
  onPing?: (timestamp: number) => Promise<any> | any;
  onComplete?: () => Promise<void> | void;
}): string {
  const onRequestHandler = handlers.onRequest ? handlers.onRequest.toString() : null;
  const onStreamHandler = handlers.onStream ? handlers.onStream.toString() : null;
  const onPingHandler = handlers.onPing ? handlers.onPing.toString() : null;
  const onCompleteHandler = handlers.onComplete ? handlers.onComplete.toString() : null;

  return `
    // Message handler setup
    onmessage = async (event) => {
      const message = event.data;

      try {
        switch (message.type) {
          case 'request':
            ${onRequestHandler ? `
              const requestHandler = ${onRequestHandler};
              const result = await requestHandler(message.payload);
              postMessage({
                id: message.id,
                type: 'response',
                payload: result
              });
            ` : `
              postMessage({
                id: message.id,
                type: 'error',
                error: 'No request handler defined'
              });
            `}
            break;

          case 'stream':
            ${onStreamHandler ? `
              const streamHandler = ${onStreamHandler};
              await streamHandler(message.payload);
            ` : `
              // No stream handler defined - ignore stream messages
            `}
            break;

          case 'ping':
            ${onPingHandler ? `
              const pingHandler = ${onPingHandler};
              const result = await pingHandler(message.payload);
              postMessage({
                id: message.id,
                type: 'pong',
                payload: result || message.payload
              });
            ` : `
              postMessage({
                id: message.id,
                type: 'pong',
                payload: message.payload
              });
            `}
            break;

          case 'complete':
            ${onCompleteHandler ? `
              const completeHandler = ${onCompleteHandler};
              await completeHandler();
            ` : `
              // No complete handler defined
            `}
            break;

          default:
            postMessage({
              id: message.id,
              type: 'error',
              error: \`Unknown message type: \${message.type}\`
            });
        }
      } catch (error) {
        postMessage({
          id: message.id,
          type: 'error',
          error: error.message || error.toString()
        });
      }
    };
  `;
}

/**
 * Creates a worker from a function that will be stringified and run in the worker context
 */
export function createWorkerFromFunction<TReturn = any>(
  fn: (data: any) => TReturn | Promise<TReturn>,
  options?: WorkerOptions
): Worker {
  const workerScript = `
    ${createWorkerScript({
      onRequest: fn
    })}
  `;

  const blob = new Blob([workerScript], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob), options);
}
