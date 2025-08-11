import { createOperator, Operator } from "../abstractions";

/**
 * Message structure exchanged between main thread and Web Workers in the Coroutine operator.
 *
 * @typedef {Object} CoroutineMessage
 * @property {number} workerId - Unique identifier of the worker instance sending or receiving the message.
 * @property {string} messageId - Unique identifier for the message to correlate requests and responses.
 * @property {*} [payload] - The actual data payload being sent or received.
 * @property {string} [error] - Error message string if the worker encountered an error processing the task.
 */
export type CoroutineMessage = {
  workerId: number;
  messageId: string;
  payload?: any;
  error?: string;
};

/**
 * Extended Operator that manages a pool of Web Workers for concurrent task processing.
 *
 * - `finalize`: Cleans up resources and terminates workers.
 * - `processTask`: Sends data to a worker and returns the processed result.
 * - `getIdleWorker`: Retrieves an available worker from the pool or creates a new one.
 * - `returnWorker`: Returns a worker back to the pool for reuse.
 */
export type Coroutine<T = any, R = any> = Operator<T, R> & {
  finalize: () => Promise<void>;
  processTask: (data: any) => Promise<R>;
  getIdleWorker: () => Promise<{ worker: Worker; workerId: number }>;
  returnWorker: (worker: Worker) => void;
};

const HELPER_SCRIPT = `
var __defProp=Object.defineProperty,__getOwnPropDescs=Object.getOwnPropertyDescriptors,__getOwnPropSymbols=Object.getOwnPropertySymbols,__hasOwnProp=Object.prototype.hasOwnProperty,__propIsEnum=Object.prototype.propertyIsEnumerable,__knownSymbol=(r,e)=>(e=Symbol[r])?e:Symbol.for("Symbol."+r),__defNormalProp=(r,e,o)=>e in r?__defProp(r,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):r[e]=o,__spreadValues=(r,e)=>{for(var o in e||={})__hasOwnProp.call(e,o)&&__defNormalProp(r,o,e[o]);if(__getOwnPropSymbols)for(var o of __getOwnPropSymbols(e))__propIsEnum.call(e,o)&&__defNormalProp(r,o,e[o]);return r},__spreadProps=(r,e)=>__defProps(r,__getOwnPropDescs(e)),__async=(r,e,o)=>new Promise((n,t)=>{var a=r=>{try{p(o.next(r))}catch(e){t(e)}},l=r=>{try{p(o.throw(r))}catch(e){t(e)}},p=r=>r.done?n(r.value):Promise.resolve(r.value).then(a,l);p((o=o.apply(r,e)).next())}),__await=function(r,e){this[0]=r,this[1]=e},__asyncGenerator=(r,e,o)=>{var n=(r,e,t,a)=>{try{var l=o[r](e),p=(e=l.value)instanceof __await,s=l.done;Promise.resolve(p?e[0]:e).then(o=>p?n("return"===r?r:"next",e[1]?{done:o.done,value:o.value}:o,t,a):t({value:o,done:s})).catch(r=>n("throw",r,t,a))}catch(y){a(y)}},t=r=>a[r]=e=>new Promise((o,t)=>n(r,e,o,t)),a={};return o=o.apply(r,e),a[__knownSymbol("asyncIterator")]=()=>a,t("next"),t("throw"),t("return"),a},__forAwait=(r,e,o)=>(e=r[__knownSymbol("asyncIterator")])?e.call(r):(r=r[__knownSymbol("iterator")](),e={},(o=(o,n)=>(n=r[o])&&(e[o]=e=>new Promise((o,t,a)=>(a=(e=n.call(r,e)).done,Promise.resolve(e.value).then(r=>o({value:r,done:a}),t)))))("next"),o("return"),e);
`;
/**
 * Coroutine operator to run tasks in a pool of Web Workers.
 * It manages a worker pool limited by hardware concurrency,
 * injects dependencies as functions, fetches a helper script if async functions detected,
 * and processes source stream values in workers sequentially.
 *
 * The operator exposes methods to finalize, process tasks directly,
 * get and return workers manually.
 */
export const coroutine = <T = any, R = any>(main: Function, ...functions: Function[]): Coroutine<T, R> => {
  const maxWorkers = navigator.hardwareConcurrency || 4;
  const workerPool: { worker: Worker; workerId: number }[] = [];
  const waitingQueue: Array<(entry: { worker: Worker; workerId: number }) => void> = [];
  let createdWorkersCount = 0;
  let workerCounter = 0;

  let blobUrlCache: string | null = null;
  let isFinalizing = false;

  const createWorker = async (): Promise<{ worker: Worker; workerId: number }> => {
    // Use inline helper script directly
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
      onmessage = async (event) => {
        const { workerId, messageId, payload } = event.data;
        try {
          const result = await mainTask(payload);
          postMessage({ workerId, messageId, payload: result });
        } catch (error) {
          postMessage({ workerId, messageId, error: error.message });
        }
      };
    `;

    if (!blobUrlCache) {
      const blob = new Blob([workerBody], { type: "application/javascript" });
      blobUrlCache = URL.createObjectURL(blob);
    }

    const workerId = ++workerCounter;
    return { worker: new Worker(blobUrlCache, { type: "module" }), workerId };
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
    if (isFinalizing) {
      worker.terminate();
      return;
    }
    if (waitingQueue.length > 0) {
      const resolve = waitingQueue.shift()!;
      resolve({ worker, workerId: (worker as any).__id });
    } else {
      workerPool.push({ worker, workerId: (worker as any).__id });
    }
  };

  const processTask = async (value: R): Promise<R> => {
    const { worker, workerId } = await getIdleWorker();
    (worker as any).__id = workerId;
    const messageId = crypto.randomUUID();

    try {
      return await new Promise<R>((resolve, reject) => {
        const messageHandler = (event: MessageEvent<CoroutineMessage>) => {
          if (event.data.messageId !== messageId) return;
          worker.removeEventListener("message", messageHandler);
          worker.removeEventListener("error", errorHandler);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve(event.data.payload);
        };

        const errorHandler = (error: ErrorEvent) => {
          worker.removeEventListener("message", messageHandler);
          worker.removeEventListener("error", errorHandler);
          reject(new Error(error.message));
        };

        worker.addEventListener("message", messageHandler);
        worker.addEventListener("error", errorHandler);
        worker.postMessage({ workerId, messageId, payload: value });
      });
    } finally {
      returnWorker(worker);
    }
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;
    while (workerPool.length > 0) workerPool.pop()!.worker.terminate();
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

  return { ...operator, finalize, processTask, getIdleWorker, returnWorker } as Coroutine;
};
