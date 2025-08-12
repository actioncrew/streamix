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
  type: 'request' | 'response' | 'error' | 'stream' | 'ping' | 'pong';
  payload: T;
  error?: string;
}

export interface WorkerConfig {
  timeout?: number;
  keepAlive?: boolean;
  maxRetries?: number;
  pingInterval?: number;
}

export interface WorkerChannel<TIn = any, TOut = any> extends Stream<TOut> {
  send: (data: TIn) => Promise<void>;
  request: (data: TIn, timeout?: number) => Promise<TOut>;
  close: () => Promise<void>;
}

export function workerChannel<TIn = any, TOut = any>(
  task: Coroutine,
  config: WorkerConfig = {}
): WorkerChannel<TIn, TOut> {
  const { timeout = 30000, keepAlive = true, pingInterval = 5000 } = config;
  let worker: InteractiveWorker | null = null;
  let closed = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  // For async iterator streaming, buffer incoming stream messages:
  const streamMessageQueue: Array<TOut> = [];
  let streamMessageResolvers: Array<(value: IteratorResult<TOut>) => void> = [];

  const initWorker = async (): Promise<InteractiveWorker> => {
    if (worker && !closed) return worker;

    const baseWorker = await task.getIdleWorker();
    worker = Object.assign(baseWorker, {
      id: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      messageId: 0,
      pendingRequests: new Map(),
    }) as InteractiveWorker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;
      if (msg.type === 'response' || msg.type === 'error') {
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
      } else if (msg.type === 'stream') {
        if (streamMessageResolvers.length > 0) {
          const resolve = streamMessageResolvers.shift()!;
          resolve({ done: false, value: msg.payload });
        } else {
          streamMessageQueue.push(msg.payload);
        }
      }
      // You can handle 'ping'/'pong' here if needed.
    };

    worker.onerror = (error: ErrorEvent) => {
      console.error('Worker error:', error);
      // Reject all pending requests
      worker!.pendingRequests.forEach(({ reject, timeout }) => {
        if (timeout) clearTimeout(timeout);
        reject(new Error(error.message));
      });
      worker!.pendingRequests.clear();
      // Reject all pending stream message resolvers
      streamMessageResolvers.forEach((resolve) =>
        resolve({ done: true, value: undefined })
      );
      streamMessageResolvers = [];
    };

    if (keepAlive && pingInterval > 0) {
      pingTimer = setInterval(() => {
        if (worker && !closed) {
          const pingMsg: WorkerMessage = {
            id: ++worker.messageId,
            type: 'ping',
            payload: Date.now(),
          };
          worker.postMessage(pingMsg);
        }
      }, pingInterval);
    }

    return worker;
  };

  const send = async (data: TIn): Promise<void> => {
    const w = await initWorker();
    const message: WorkerMessage<TIn> = {
      id: ++w.messageId,
      type: 'stream',
      payload: data,
    };
    w.postMessage(message);
  };

  const request = async (data: TIn, requestTimeout = timeout): Promise<TOut> => {
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
    closed = true;
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (worker) {
      worker.pendingRequests.forEach(({ reject, timeout }) => {
        if (timeout) clearTimeout(timeout);
        reject(new Error('Worker connection closed'));
      });
      worker.pendingRequests.clear();

      // Resolve any pending stream reads as done:
      streamMessageResolvers.forEach((resolve) => resolve({ done: true, value: undefined }));
      streamMessageResolvers = [];
      streamMessageQueue.length = 0;

      if (keepAlive) {
        task.returnWorker(worker);
      } else {
        worker.terminate();
      }
      worker = null;
    }
  };

  const stream = createStream<TOut>('workerChannel', async function* () {
    await initWorker();

    try {
      while (!closed) {
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

  return Object.assign(stream, { send, request, close }) as WorkerChannel<TIn, TOut>;
}

/**
 * Operator that sends each stream value to a worker and yields the response
 */
export function workerMap<T, R>(
  task: Coroutine,
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
  task: Coroutine,
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
  task: Coroutine,
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
 * Helper function to create worker scripts that handle the extended message protocol
 */
/**
 * Helper function to create worker scripts that handle the extended message protocol
 */
export function createWorkerScript(handlers: {
  onRequest?: (data: any) => Promise<any> | any;
  onStream?: (data: any) => Promise<void> | void;
  onPing?: (timestamp: number) => Promise<any> | any;
}): string {
  const onRequestHandler = handlers.onRequest ? handlers.onRequest.toString() : null;
  const onStreamHandler = handlers.onStream ? handlers.onStream.toString() : null;
  const onPingHandler = handlers.onPing ? handlers.onPing.toString() : null;

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
