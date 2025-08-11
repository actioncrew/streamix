import { createOperator, Operator } from "../abstractions";
import { createSubject, Subject } from "../subjects";

/**
 * Message structure exchanged between main thread and Web Workers in the Coroutine operator.
 *
 * @typedef {Object} CoroutineMessage
 * @property {number} workerId - Unique identifier of the worker instance sending or receiving the message.
 * @property {string} messageId - Unique identifier for the message to correlate requests and responses.
 * @property {*} [payload] - The actual data payload being sent or received.
 * @property {string} [error] - Error message string if the worker encountered an error processing the task.
 * @property {'task'|'broadcast'|'response'} [type] - Message type for routing
 */
export type CoroutineMessage = {
  workerId: number;
  messageId: string;
  payload?: any;
  error?: string;
  type?: 'task' | 'broadcast' | 'response';
};

/**
 * Subject interface for bidirectional communication with workers
 */
export type CoroutineSubject<T = any, R = any> = {
  /** Send data to all workers */
  broadcast: (data: T) => Promise<void>;
  /** Send data to a specific worker */
  send: (workerId: number, data: T) => Promise<R>;
  /** Subscribe to messages from a specific worker */
  subscribe: (workerId: number, callback: (data: R) => void) => () => void;
  /** Subscribe to messages from all workers */
  subscribeAll: (callback: (data: R, workerId: number) => void) => () => void;
  /** Get a Subject stream for worker messages */
  asSubject: () => Subject<{ data: R; workerId: number }>;
};

/**
 * Extended Operator that manages a pool of Web Workers for concurrent task processing
 * with bidirectional Subject-based communication.
 */
export type Coroutine<T = any, R = any> = Operator<T, R> & {
  finalize: () => Promise<void>;
  assignTask: (workerId: number, data: T) => Promise<R>;
  processTask: (data: any) => Promise<R>;
  getIdleWorker: () => Promise<{ worker: Worker; workerId: number }>;
  returnWorker: (worker: Worker) => void;
  subject: CoroutineSubject<T, R>;
};

/**
 * Minified helper script used inside Web Worker blobs.
 */
const HELPER_SCRIPT = `var __defProp=Object.defineProperty,__getOwnPropDescs=Object.getOwnPropertyDescriptors,__getOwnPropSymbols=Object.getOwnPropertySymbols,__hasOwnProp=Object.prototype.hasOwnProperty,__propIsEnum=Object.prototype.propertyIsEnumerable,__knownSymbol=(r,e)=>(e=Symbol[r])?e:Symbol.for("Symbol."+r),__defNormalProp=(r,e,o)=>e in r?__defProp(r,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):r[e]=o,__spreadValues=(r,e)=>{for(var o in e||={})__hasOwnProp.call(e,o)&&__defNormalProp(r,o,e[o]);if(__getOwnPropSymbols)for(var o of __getOwnPropSymbols(e))__propIsEnum.call(e,o)&&__defNormalProp(r,o,e[o]);return r},__spreadProps=(r,e)=>__defProps(r,__getOwnPropDescs(e)),__async=(r,e,o)=>new Promise((n,t)=>{var a=r=>{try{p(o.next(r))}catch(e){t(e)}},l=r=>{try{p(o.throw(r))}catch(e){t(e)}},p=r=>r.done?n(r.value):Promise.resolve(r.value).then(a,l);p((o=o.apply(r,e)).next())}),__await=function(r,e){this[0]=r,this[1]=e},__asyncGenerator=(r,e,o)=>{var n=(r,e,t,a)=>{try{var l=o[r](e),p=(e=l.value)instanceof __await,s=l.done;Promise.resolve(p?e[0]:e).then(o=>p?n("return"===r?r:"next",e[1]?{done:o.done,value:o.value}:o,t,a):t({value:o,done:s})).catch(r=>n("throw",r,t,a))}catch(y){a(y)}},t=r=>a[r]=e=>new Promise((o,t)=>n(r,e,o,t)),a={};return o=o.apply(r,e),a[__knownSymbol("asyncIterator")]=()=>a,t("next"),t("throw"),t("return"),a},__forAwait=(r,e,o)=>(e=r[__knownSymbol("asyncIterator")])?e.call(r):(r=r[__knownSymbol("iterator")](),e={},(o=(o,n)=>(n=r[o])&&(e[o]=e=>new Promise((o,t,a)=>(a=(e=n.call(r,e)).done,Promise.resolve(e.value).then(r=>o({value:r,done:a}),t)))))("next"),o("return"),e);`;

/**
 * Counter to assign unique numeric IDs to workers created by the Coroutine.
 * Incremented each time a new worker instance is spawned to maintain uniqueness.
 */
let workerIdentifierCounter = 0;

/**
 * Coroutine operator to run tasks in a pool of Web Workers with Subject-based communication.
 * It manages a worker pool limited by hardware concurrency,
 * injects dependencies as functions, and provides bidirectional communication
 * through a Subject interface.
 */
export const coroutine = <T = any, R = any>(main: Function, ...functions: Function[]): Coroutine<T, R> => {
  const maxWorkers = navigator.hardwareConcurrency || 4;
  const workerPool: { worker: Worker; workerId: number }[] = [];
  const waitingQueue: Array<(entry: { worker: Worker; workerId: number }) => void> = [];
  const activeWorkers = new Map<number, Worker>();
  const pendingMessages = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();

  let createdWorkersCount = 0;
  let blobUrlCache: string | null = null;
  let isFinalizing = false;

  // Subject for worker messages
  const messageSubject = createSubject<{ data: R; workerId: number }>();
  const allSubscribers = new Set<(data: R, workerId: number) => void>();
  const workerSubscribers = new Map<number, Set<(data: R) => void>>();

  const createWorker = async (): Promise<{ worker: Worker; workerId: number }> => {
    const helperScript = HELPER_SCRIPT;

    const injectedDependencies = functions
      .map((fn) => {
        let fnBody = fn.toString();
        fnBody = fnBody.replace(/function[\s]*\(/, `function ${fn.name || ""}(`);
        return fnBody;
      })
      .join(";\n");

    const mainTaskBody = main.toString().replace(/function[\s]*\(/, `function ${main.name || ""}(`);

    const workerBody = `
      ${helperScript}
      ${injectedDependencies};
      const mainTask = ${mainTaskBody};

      // Handle different message types
      onmessage = async (event) => {
        const { workerId, messageId, payload, type = 'task' } = event.data;

        try {
          if (type === 'task') {
            const result = await mainTask(payload);
            postMessage({ workerId, messageId, payload: result, type: 'response' });
          } else if (type === 'broadcast') {
            // Handle broadcast messages - can send responses back
            const result = await mainTask(payload);
            postMessage({ workerId, messageId, payload: result, type: 'broadcast' });
          }
        } catch (error) {
          postMessage({ workerId, messageId, error: error.message, type: 'response' });
        }
      };
    `;

    if (!blobUrlCache) {
      const blob = new Blob([workerBody], { type: "application/javascript" });
      blobUrlCache = URL.createObjectURL(blob);
    }

    const workerId = ++workerIdentifierCounter;
    const worker = new Worker(blobUrlCache, { type: "module" });

    // Set up message handling for this worker
    worker.addEventListener("message", (event: MessageEvent<CoroutineMessage>) => {
      const { messageId, payload, error, workerId: msgWorkerId, type } = event.data;

      if (type === 'broadcast') {
        // Handle broadcast responses
        allSubscribers.forEach(callback => callback(payload, msgWorkerId));
        messageSubject.next({ data: payload, workerId: msgWorkerId });

        // Notify specific worker subscribers
        const specificSubscribers = workerSubscribers.get(msgWorkerId);
        if (specificSubscribers) {
          specificSubscribers.forEach(callback => callback(payload));
        }
      } else {
        // Handle regular task responses
        const pending = pendingMessages.get(messageId);
        if (pending) {
          pendingMessages.delete(messageId);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(payload);
          }
        }
      }
    });

    (worker as any).__id = workerId;
    activeWorkers.set(workerId, worker);

    return { worker, workerId };
  };

  const getIdleWorker = async (): Promise<{ worker: Worker; workerId: number }> => {
    if (workerPool.length > 0) return workerPool.shift()!;
    if (createdWorkersCount < maxWorkers) {
      createdWorkersCount++;
      return await createWorker();
    }
    return new Promise((resolve) => waitingQueue.push(resolve));
  };

  const returnWorker = (worker: Worker): void => {
    const workerId = (worker as any).__id;
    if (isFinalizing) {
      activeWorkers.delete(workerId);
      worker.terminate();
      return;
    }
    if (waitingQueue.length > 0) {
      const resolve = waitingQueue.shift()!;
      resolve({ worker, workerId });
    } else {
      workerPool.push({ worker, workerId });
    }
  };

  const assignTask = async (workerId: number, data: T): Promise<R> => {
    const worker = activeWorkers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found or is not active`);
    }
    const messageId = crypto.randomUUID();

    return new Promise<R>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingMessages.delete(messageId);
        reject(new Error('Worker assignTask timeout'));
      }, 30000); // 30 second timeout

      pendingMessages.set(messageId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      worker.postMessage({ workerId, messageId, payload: data, type: 'task' });
    });
  };

  const processTask = async (value: T): Promise<R> => {
    const { worker, workerId } = await getIdleWorker();
    const messageId = crypto.randomUUID();

    try {
      return await new Promise<R>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingMessages.delete(messageId);
          reject(new Error('Worker task timeout'));
        }, 30000); // 30 second timeout

        pendingMessages.set(messageId, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });

        worker.postMessage({ workerId, messageId, payload: value, type: 'task' });
      });
    } finally {
      returnWorker(worker);
    }
  };

  // Subject interface implementation
  const subject: CoroutineSubject<T, R> = {
    broadcast: async (data: T): Promise<void> => {
      const promises: Promise<void>[] = [];

      activeWorkers.forEach((worker, workerId) => {
        const messageId = crypto.randomUUID();
        promises.push(new Promise<void>((resolve) => {
          worker.postMessage({ workerId, messageId, payload: data, type: 'broadcast' });
          resolve();
        }));
      });

      await Promise.all(promises);
    },

    send: async (targetWorkerId: number, data: T): Promise<R> => {
      const worker = activeWorkers.get(targetWorkerId);
      if (!worker) {
        throw new Error(`Worker ${targetWorkerId} not found`);
      }

      const messageId = crypto.randomUUID();
      return new Promise<R>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingMessages.delete(messageId);
          reject(new Error('Worker send timeout'));
        }, 30000);

        pendingMessages.set(messageId, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });

        worker.postMessage({ workerId: targetWorkerId, messageId, payload: data, type: 'task' });
      });
    },

    subscribe: (workerId: number, callback: (data: R) => void): (() => void) => {
      if (!workerSubscribers.has(workerId)) {
        workerSubscribers.set(workerId, new Set());
      }
      const subscribers = workerSubscribers.get(workerId)!;
      subscribers.add(callback);

      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          workerSubscribers.delete(workerId);
        }
      };
    },

    subscribeAll: (callback: (data: R, workerId: number) => void): (() => void) => {
      allSubscribers.add(callback);
      return () => allSubscribers.delete(callback);
    },

    asSubject: (): Subject<{ data: R; workerId: number }> => {
      return messageSubject;
    }
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    // Clear all pending messages
    pendingMessages.clear();

    // Terminate all workers
    activeWorkers.forEach((worker) => {
      worker.terminate();
    });
    activeWorkers.clear();

    while (workerPool.length > 0) {
      const { worker } = workerPool.pop()!;
      worker.terminate();
    }

    waitingQueue.length = 0;
    allSubscribers.clear();
    workerSubscribers.clear();

    if (blobUrlCache) {
      URL.revokeObjectURL(blobUrlCache);
      blobUrlCache = null;
    }
  };

  const operator = createOperator<T, R>("coroutine", (source) => ({
    async next() {
      if (isFinalizing) return { done: true, value: undefined };
      const { done, value } = await source.next();
      if (done) {
        await finalize();
        return { done: true, value: undefined };
      }
      return { done: false, value: await processTask(value as any) };
    },
    async return() {
      await finalize();
      return { done: true, value: undefined };
    },
    async throw(err) {
      await finalize();
      throw err;
    }
  }));

  return {
    ...operator,
    finalize,
    assignTask,
    processTask,
    getIdleWorker,
    returnWorker,
    subject
  } as Coroutine<T, R>;
};
