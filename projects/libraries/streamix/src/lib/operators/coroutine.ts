import { createOperator, Operator } from "../abstractions";

/**
 * Message structure exchanged between main thread and Web Workers in the Coroutine operator.
 */
export type CoroutineMessage = {
  workerId: number;
  taskId: string;
  type: string;
  payload?: any;
  error?: string;
};

/**
 * Configuration options for the worker script generation.
 */
export type WorkerConfig = {
  /** Custom worker script template. Use {HELPERS}, {DEPENDENCIES}, {MAIN_TASK} as placeholders */
  template?: string;
  /** Custom helper scripts to inject */
  helpers?: string[];
  /** Custom initialization code that runs when worker starts */
  initCode?: string;
  /** Additional imports or global variables */
  globals?: string;
};

/**
 * Configuration object for the Coroutine factory.
 */
export type CoroutineConfig = {
  maxWorkers?: number;
  workerConfig?: WorkerConfig;
  /** A custom message handler for all messages from the worker. */
  customMessageHandler?: (
    event: MessageEvent<CoroutineMessage>,
    worker: Worker,
    pendingMessages: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>
  ) => void;
};

/**
 * Extended Operator that manages a pool of Web Workers for concurrent task processing.
 */
export type Coroutine<T = any, R = T> = Operator<T, R> & {
  assignTask: (workerId: number, data: T) => Promise<R>;
  processTask: (data: T) => Promise<R>;
  getIdleWorker: () => Promise<{ worker: Worker; workerId: number }>;
  returnWorker: (workerId: number) => void;
  finalize: () => Promise<void>;
};

/**
 * Callback function to report progress updates from a task.
 */
export type ProgressCallback = (progressData: any) => void;

/**
 * The utility functions passed to the worker's main task function.
 */
export type WorkerUtils = {
  requestData: (payload: any) => Promise<any>;
  reportProgress: (progressData: any) => void;
};

/**
 * Type for the main task function running inside the worker.
 */
export type MainTask<T = any, R = any> =
  | ((data: T) => Promise<R> | R)
  | ((data: T, utils: WorkerUtils) => Promise<R> | R);

/**
 * Default worker script template with placeholders
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
        postMessage({ workerId, taskId, type: 'request_data', payload });
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
const HELPER_SCRIPT = `var __defProp=Object.defineProperty,__getOwnPropDescs=Object.getOwnPropertyDescriptors,__getOwnPropSymbols=Object.getOwnPropertySymbols,__hasOwnProp=Object.prototype.hasOwnProperty,__propIsEnum=Object.prototype.propertyIsEnumerable,__knownSymbol=(r,e)=>(e=Symbol[r])?e:Symbol.for("Symbol."+r),__defNormalProp=(r,e,o)=>e in r?__defProp(r,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):r[e]=o,__spreadValues=(r,e)=>{for(var o in e||={})__hasOwnProp.call(e,o)&&__defNormalProp(r,o,e[o]);if(__getOwnPropSymbols)for(var o of __getOwnPropSymbols(e))__propIsEnum.call(e,o)&&__defNormalProp(r,o,e[o]);return r},__spreadProps=(r,e)=>__defProps(r,__getOwnPropDescs(e)),__async=(r,e,o)=>new Promise((n,t)=>{var a=r=>{try{p(o.next(r))}catch(e){t(e)}},l=r=>{try{p(o.throw(r))}catch(e){t(e)}},p=r=>r.done?n(r.value):Promise.resolve(r.value).then(a,l);p((o=o.apply(r,e)).next())}),__await=function(r,e){this[0]=r,this[1]=e},__asyncGenerator=(r,e,o)=>{var n=(r,e,t,a)=>{try{var l=o[r](e),p=(e=l.value)instanceof __await,s=l.done;Promise.resolve(p?e[0]:e).then(o=>p?n("return"===r?r:"next",e[1]?{done:o.done,value:o.value}:o,t,a):t({value:o,done:s})).catch(r=>n("throw",r,t,a))}catch(y){a(y)}},t=r=>a[r]=e=>new Promise((o,t)=>n(r,e,o,t)),a={};return o=o.apply(r,e),a[__knownSymbol("asyncIterator")]=()=>a,t("next"),t("throw"),t("return"),a},__forAwait=(r,e,o)=>(e=r[__knownSymbol("asyncIterator")])?e.call(r):(r=r[__knownSymbol("iterator")](),e={},(o=(o,n)=>(n=r[o])&&(e[o]=e=>new Promise((o,t,a)=>(a=(e=n.call(r,e)).done,Promise.resolve(e.value).then(r=>o({value:r,done:a}),t)))))("next"),o("return"),e);`;

let workerIdentifierCounter = 0;

export function createCoroutine(config: CoroutineConfig): <T, R>(main: MainTask<T, R>, ...functions: Function[]) => Coroutine<T, R>;
export function createCoroutine<T, R>(main: MainTask<T, R>, ...functions: Function[]): Coroutine<T, R>;
export function createCoroutine<T, R>(
  arg1: CoroutineConfig | MainTask<T, R>,
  ...rest: Function[]
): Coroutine<T, R> | ((main: MainTask<T, R>, ...functions: Function[]) => Coroutine<T, R>) {

  // This is the implementation function that does the heavy lifting
  const implementCoroutine = (config: CoroutineConfig, main: MainTask<T, R>, functions: Function[]): Coroutine<T, R> => {
    const maxWorkers = config.maxWorkers || navigator.hardwareConcurrency || 4;
    const customMessageHandler = config.customMessageHandler;

    const workerPool: { worker: Worker; workerId: number }[] = [];
    const waitingQueue: Array<(entry: { worker: Worker; workerId: number }) => void> = [];
    const activeWorkers = new Map<number, Worker>();
    const pendingMessages = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();

    let createdWorkersCount = 0;
    let blobUrlCache: string | null = null;
    let isFinalizing = false;

    const generateWorkerScript = (workerConfig: WorkerConfig): string => {
      const template = workerConfig.template || DEFAULT_WORKER_TEMPLATE;
      const globals = workerConfig.globals || '';
      const helpers = (workerConfig.helpers || [HELPER_SCRIPT]).join('\n');
      const dependencies = functions
        .map((fn) => fn.toString().replace(/function[\s]*\(/, `function ${fn.name || ""}(`))
        .join(';\n');
      const initCode = workerConfig.initCode || '';
      const mainTaskBody = main.toString().replace(/function[\s]*\(/, `function ${main.name || ""}(`);

      return template
        .replace('{GLOBALS}', globals)
        .replace('{HELPERS}', helpers)
        .replace('{DEPENDENCIES}', dependencies)
        .replace('{INIT_CODE}', initCode)
        .replace('{MAIN_TASK}', mainTaskBody);
    };

    // --- Corrected `defaultMessageHandler` to accept the worker and pendingMessages map
    const defaultMessageHandler = (
      event: MessageEvent<CoroutineMessage>,
      worker: Worker,
      pendingMessages: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>
    ) => {
      const msg = event.data;
      const { taskId, payload, error, type, workerId } = msg;

      const pending = pendingMessages.get(taskId);

      switch (type) {
        case 'response':
          if (pending) {
            pendingMessages.delete(taskId);
            pending.resolve(payload);
          }
          break;
        case 'error':
          if (pending) {
            pendingMessages.delete(taskId);
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
    // --- End corrected `defaultMessageHandler`

    const createWorker = async (): Promise<{ worker: Worker; workerId: number }> => {
      const workerId = ++workerIdentifierCounter;
      const workerBody = generateWorkerScript(config.workerConfig || {});

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
  // --- End overloaded function implementation
}
