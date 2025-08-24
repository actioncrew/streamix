import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";

/**
 * @typedef {object} CoroutineMessage
 * Message structure exchanged between main thread and Web Workers in the Coroutine operator.
 * @property {number} workerId - The unique ID of the worker.
 * @property {string} taskId - The unique ID of the task.
 * @property {string} type - The type of message (e.g., 'task', 'response', 'error').
 * @property {any} [payload] - The optional message payload.
 * @property {string} [error] - The optional error message.
 */
export type CoroutineMessage = {
  workerId: number;
  taskId: string;
  type: string;
  payload?: any;
  error?: string;
};

/**
 * @typedef {object} CoroutineConfig
 * Configuration object for the Coroutine factory.
 * @property {string} [template] - Custom worker script template. Use {HELPERS}, {DEPENDENCIES}, {MAIN_TASK} as placeholders.
 * @property {string[]} [helpers] - Custom helper scripts to inject.
 * @property {string} [initCode] - Custom initialization code that runs when the worker starts.
 * @property {string} [globals] - Additional imports or global variables.
 * @property {function(MessageEvent<CoroutineMessage>, Worker, Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>): void} [customMessageHandler] - A custom message handler for all messages from the worker.
 */
export type CoroutineConfig = {
  template?: string;
  helpers?: string[];
  initCode?: string;
  globals?: string;
  customMessageHandler?: (
    event: MessageEvent<CoroutineMessage>,
    worker: Worker,
    pendingTasks: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>
  ) => void;
};

/**
 * @typedef {Operator<T, R> & {
 * assignTask: (workerId: number, data: T) => Promise<R>;
 * processTask: (data: T) => Promise<R>;
 * getIdleWorker: () => Promise<{ worker: Worker; workerId: number }>;
 * returnWorker: (workerId: number) => void;
 * finalize: () => Promise<void>;
 * }} Coroutine
 * @template T
 * @template R
 * Extended Operator that manages a pool of Web Workers for concurrent task processing.
 */
export type Coroutine<T = any, R = T> = Operator<T, R> & {
  /**
   * Assigns a task to a specific worker in the pool.
   *
   * @param workerId The ID of the worker to which the task will be assigned.
   * @param data The input data for the task.
   * @returns A Promise that resolves with the result of the task.
   */
  assignTask: (workerId: number, data: T) => Promise<R>;
  /**
   * Processes a task by assigning it to the next available worker in the pool.
   * This is the primary method for offloading work.
   *
   * @param data The input data for the task.
   * @returns A Promise that resolves with the result of the task.
   */
  processTask: (data: T) => Promise<R>;
  /**
   * Retrieves a worker from the pool that is ready to accept a new task.
   * If no workers are available, a new one may be created, up to a maximum limit.
   *
   * @returns A Promise that resolves with an object containing the worker and its ID.
   */
  getIdleWorker: () => Promise<{ worker: Worker; workerId: number }>;
  /**
   * Returns a worker to the pool, making it available for subsequent tasks.
   *
   * @param workerId The ID of the worker to return.
   */
  returnWorker: (workerId: number) => void;
  /**
   * Terminates all active workers and cleans up all related resources,
   * including the object URL for the worker script.
   *
   * @returns A Promise that resolves when all cleanup is complete.
   */
  finalize: () => Promise<void>;
};

/**
 * @callback ProgressCallback
 * @param {any} progressData - The data object containing progress information.
 * Callback function to report progress updates from a task.
 */
export type ProgressCallback = (progressData: any) => void;

/**
 * @typedef {object} WorkerUtils
 * The utility functions passed to the worker's main task function.
 * @property {(payload: any) => Promise<any>} requestData - A function to request data from the main thread.
 * @property {(progressData: any) => void} reportProgress - A function to report progress updates to the main thread.
 */
export type WorkerUtils = {
  requestData: (payload: any) => Promise<any>;
  reportProgress: (progressData: any) => void;
};

/**
 * @typedef {(data: T) => Promise<R> | R | ((data: T, utils: WorkerUtils) => Promise<R> | R)} MainTask
 * @template T
 * @template R
 * Type for the main task function running inside the worker.
 */
export type MainTask<T = any, R = any> =
  | ((data: T) => Promise<R> | R)
  | ((data: T, utils: WorkerUtils) => Promise<R> | R);

/**
 * Default worker script template with placeholders.
 */
const DEFAULT_WORKER_TEMPLATE = `
{GLOBALS}
{HELPERS}
{DEPENDENCIES}
{INIT_CODE}
const __mainTask = {MAIN_TASK};

// A map to store promises for pending data requests from the worker
const __pendingWorkerRequests = new Map();

// A helper function for the worker to request data from the main thread
const __requestData = (workerId, taskId, payload) => {
  return new Promise(resolve => {
    __pendingWorkerRequests.set(taskId, resolve);
    postMessage({ workerId, taskId, type: 'request', payload });
  });
};

const __reportProgress = (workerId, taskId) => (progressData) => {
  postMessage({ workerId, taskId, payload: progressData, type: 'progress' });
};

onmessage = async (event) => {
  const { workerId, taskId, payload, type } = event.data;

  // If this is a response to a data request from the worker
  if (type === 'data') {
    const resolve = __pendingWorkerRequests.get(taskId);
    if (resolve) {
      __pendingWorkerRequests.delete(taskId);
      resolve(payload);
    }
    return;
  }

  // This is the initial task from the main thread
  if (type === 'task') {
    try {
      let result;
      const utils = {
        requestData: (requestPayload) => __requestData(workerId, taskId, requestPayload),
        reportProgress: __reportProgress(workerId, taskId)
      };
      // Check if mainTask expects a utils object
      if (__mainTask.length >= 2) {
        result = await __mainTask(payload, utils);
      } else {
        result = await __mainTask(payload);
      }
      postMessage({ workerId, taskId, payload: result, type: 'response' });
    } catch (error) {
      postMessage({ workerId, taskId, error: error.message, type: 'error' });
    }
  }
};`;

/**
 * Minified helper script used inside Web Worker blobs.
 */
const HELPER_SCRIPT = `var __defProp=Object.defineProperty,__defProps=Object.defineProperties,__getOwnPropDescs=Object.getOwnPropertyDescriptors,__getOwnPropSymbols=Object.getOwnPropertySymbols,__hasOwnProp=Object.prototype.hasOwnProperty,__propIsEnum=Object.prototype.propertyIsEnumerable,__knownSymbol=(r,e)=>(e=Symbol[r])?e:Symbol.for("Symbol."+r),__defNormalProp=(r,e,o)=>e in r?__defProp(r,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):r[e]=o,__spreadValues=(r,e)=>{for(var o in e||={})__hasOwnProp.call(e,o)&&__defNormalProp(r,o,e[o]);if(__getOwnPropSymbols)for(var o of __getOwnPropSymbols(e))__propIsEnum.call(e,o)&&__defNormalProp(r,o,e[o]);return r},__spreadProps=(r,e)=>__defProps(r,__getOwnPropDescs(e)),__async=(r,e,o)=>new Promise((t,n)=>{var a=r=>{try{s(o.next(r))}catch(e){n(e)}},p=r=>{try{s(o.throw(r))}catch(e){n(e)}},s=r=>r.done?t(r.value):Promise.resolve(r.value).then(a,p);s((o=o.apply(r,e)).next())}),__await=function(r,e){this[0]=r,this[1]=e},__asyncGenerator=(r,e,o)=>{var t=(r,e,n,a)=>{try{var p=o[r](e),s=(e=p.value)instanceof __await,l=p.done;Promise.resolve(s?e[0]:e).then(o=>s?t("return"===r?r:"next",e[1]?{done:o.done,value:o.value}:o,n,a):n({value:o,done:l})).catch(r=>t("throw",r,n,a))}catch(y){a(y)}},n=r=>a[r]=e=>new Promise((o,n)=>t(r,e,o,n)),a={};return o=o.apply(r,e),a[__knownSymbol("asyncIterator")]=()=>a,n("next"),n("throw"),n("return"),a};`;

/**
 * Unique worker identifier counter
 */
let workerIdentifierCounter = 0;

/**
 * Creates a coroutine operator for managing a pool of Web Workers.
 *
 * This function has two overloaded signatures:
 * 1. `coroutine(config)`: Returns a factory function that takes a main task and helper functions.
 * 2. `coroutine(mainTask, ...helpers)`: Directly creates a coroutine operator with a default configuration.
 *
 * This operator is a powerful tool for offloading computationally intensive tasks from the main
 * thread, allowing for concurrent processing of stream data without blocking the UI. It manages a pool
 * of workers, dynamically scaling up to `navigator.hardwareConcurrency` and reusing workers
 * to minimize overhead.
 *
 * @template T The type of the input data for the main task.
 * @template R The type of the return value from the main task.
 * @param {CoroutineConfig} config - The configuration object for the worker pool.
 * @returns {<T, R>(main: MainTask<T, R>, ...functions: Function[]) => Coroutine<T, R>} A higher-order function for creating a Coroutine operator.
 */
export function coroutine(config: CoroutineConfig): <T, R>(main: MainTask<T, R>, ...functions: Function[]) => Coroutine<T, R>;

/**
 * Creates a coroutine operator with a default configuration.
 * @template T The type of the input data for the main task.
 * @template R The type of the return value from the main task.
 * @param {MainTask<T, R>} main - The main task function to run inside the workers.
 * @param {Function[]} functions - Any helper functions required by the main task.
 * @returns {Coroutine<T, R>} A Coroutine operator.
 */
export function coroutine<T, R>(main: MainTask<T, R>, ...functions: Function[]): Coroutine<T, R>;
export function coroutine<T, R>(
  arg1: CoroutineConfig | MainTask<T, R>,
  ...rest: Function[]
): Coroutine<T, R> | ((main: MainTask<T, R>, ...functions: Function[]) => Coroutine<T, R>) {

  // This is the implementation function that does the heavy lifting
  const implementCoroutine = (config: CoroutineConfig, main: MainTask<T, R>, functions: Function[]): Coroutine<T, R> => {
    const maxWorkers = navigator.hardwareConcurrency || 4;
    const customMessageHandler = config.customMessageHandler;

    const workerPool: { worker: Worker; workerId: number }[] = [];
    const waitingQueue: Array<(entry: { worker: Worker; workerId: number }) => void> = [];
    const activeWorkers = new Map<number, Worker>();
    const pendingMessages = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();

    let createdWorkersCount = 0;
    let blobUrlCache: string | null = null;
    let isFinalizing = false;

    const generateWorkerScript = (config: CoroutineConfig): string => {
      const template = config.template || DEFAULT_WORKER_TEMPLATE;
      const globals = config.globals || '';
      const helpers = ([HELPER_SCRIPT, ...(config.helpers || [])]).join('\n');
      const dependencies = functions
        .map((fn) => fn.toString().replace(/function[\s]*\(/, `function ${fn.name || ""}(`))
        .join(';\n');
      const initCode = config.initCode || '';
      const mainTaskBody = main.toString().replace(/function[\s]*\(/, `function ${main.name || ""}(`);

      return template
        .replace('{GLOBALS}', globals)
        .replace('{HELPERS}', helpers)
        .replace('{DEPENDENCIES}', dependencies)
        .replace('{INIT_CODE}', initCode)
        .replace('{MAIN_TASK}', mainTaskBody);
    };

    const defaultMessageHandler = (
      event: MessageEvent<CoroutineMessage>,
      worker: Worker,
      pendingTasks: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>
    ) => {
      const msg = event.data;
      const { taskId, payload, error, type, workerId } = msg;

      const pending = pendingTasks.get(taskId);

      switch (type) {
        case 'response':
          if (pending) {
            pendingTasks.delete(taskId);
            pending.resolve(payload);
          }
          break;
        case 'error':
          console.warn(`Error received from worker ${workerId} for task ${taskId}:`, error);
          if (pending) {
            pendingTasks.delete(taskId);
            pending.reject(new Error(error ?? 'Unknown worker error'));
          }
          break;
        case 'request':
          console.warn(`Worker with ID ${workerId} requested data for taskId ${taskId}:`, payload);
          // Send dummy data back to the worker to prevent it from hanging
          worker.postMessage({ workerId, taskId, type: 'data', payload: { message: "This is dummy data from the main thread." } });
          break;
        case 'progress':
          console.warn(`Worker with ID ${workerId} progress update for taskId ${taskId}:`, payload);
          break;
        default:
          console.warn('Unknown message type from worker:', msg);
          break;
      }
    };

    const createWorker = async (): Promise<{ worker: Worker; workerId: number }> => {
      const workerId = ++workerIdentifierCounter;
      const workerBody = generateWorkerScript(config || {});

      if (!blobUrlCache) {
        const blob = new Blob([workerBody], { type: "application/javascript" });
        blobUrlCache = URL.createObjectURL(blob);
      }

      const worker = new Worker(blobUrlCache, { type: "module" });

      // --- Corrected `createWorker` to pass `worker` and `pendingMessages` to both handlers
      const messageHandler = customMessageHandler
        ? (event: MessageEvent<CoroutineMessage>) => customMessageHandler(event, worker, pendingMessages)
        : (event: MessageEvent<CoroutineMessage>) => defaultMessageHandler(event, worker, pendingMessages);
      // --- End corrected `createWorker`

      worker.addEventListener("message", messageHandler);
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

    const returnWorker = (workerId: number): void => {
      const worker = activeWorkers.get(workerId);
      if (!worker) {
        console.warn(`Worker with id ${workerId} not found.`);
        return;
      }
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
      const taskId = crypto.randomUUID();
      return new Promise<R>((resolve, reject) => {
        pendingMessages.set(taskId, { resolve, reject });
        worker.postMessage({ workerId, taskId, payload: data, type: 'task' });
      });
    };

    const processTask = async (value: T): Promise<R> => {
      const { worker, workerId } = await getIdleWorker();
      const taskId = crypto.randomUUID();
      try {
        return await new Promise<R>((resolve, reject) => {
          pendingMessages.set(taskId, { resolve, reject });
          worker.postMessage({ workerId, taskId, payload: value, type: 'task' });
        });
      } finally {
        returnWorker(workerId);
      }
    };

    const finalize = async () => {
      if (isFinalizing) return;
      isFinalizing = true;
      pendingMessages.clear();
      activeWorkers.forEach((worker) => worker.terminate());
      activeWorkers.clear();
      while (workerPool.length > 0) {
        const { worker } = workerPool.pop()!;
        worker.terminate();
      }
      waitingQueue.length = 0;
      if (blobUrlCache) {
        URL.revokeObjectURL(blobUrlCache);
        blobUrlCache = null;
      }
    };

    const operator = createOperator<T, R>("coroutine", function(this: Operator, source) {
      let completed = false;

      return {
        next: async() => {
          while (true) {
            if (completed || isFinalizing) {
              return DONE;
            }

            const result = createStreamResult(await source.next());
            if (result.done) {
              completed = true;
              await finalize();
              return DONE;
            }

            const taskResult = await processTask(result.value as any);
            return NEXT(taskResult);
          }
        },
        async return() {
          completed = true;
          await finalize();
          return DONE;
        },
        async throw(err) {
          completed = true;
          await finalize();
          throw err;
        }
      };
    });

    return {
      ...operator,
      finalize,
      assignTask,
      processTask,
      getIdleWorker,
      returnWorker,
    } as Coroutine<T, R>;
  };

  // --- Overloaded function implementation logic
  if (typeof arg1 === 'function') {
    // Direct invocation: createCoroutine(mainTask, helper1, ...)
    const main = arg1 as MainTask<T, R>;
    const functions = rest as Function[];
    const config: CoroutineConfig = {};
    return implementCoroutine(config, main, functions);
  } else {
    // Higher-order function: createCoroutine(config)(mainTask, helper1, ...)
    const config = arg1 as CoroutineConfig;
    return (main: MainTask<T, R>, ...functions: Function[]) => implementCoroutine(config, main, functions);
  }
}
