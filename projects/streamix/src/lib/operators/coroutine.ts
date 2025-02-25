import { createEmission, createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject, Subject } from '../streams';

export type Coroutine = StreamOperator & {
  finalize: () => Promise<void>;
  processTask: (data: any) => Promise<any>;
  getIdleWorker: () => Promise<Worker>;
  returnWorker: (worker: Worker) => void;
};

export const coroutine = (...functions: Function[]): Coroutine => {
  if (functions.length === 0) {
    throw new Error("At least one function (the main task) is required.");
  }

  const maxWorkers = navigator.hardwareConcurrency || 4;
  const workerPool: Worker[] = [];
  const workerQueue: Array<(worker: Worker) => void> = [];
  let isFinalizing = false;

  const initWorkers = () => {
    const asyncPresent = functions.some(fn => fn.toString().includes("__async"));
    const [mainTask, ...dependencies] = functions;

    const injectedDependencies = dependencies.map(fn => {
      let fnBody = fn.toString();
      fnBody = fnBody.replace(/function[\s]*\(/, `function ${fn.name}(`);
      return fnBody;
    }).join(';');

    const mainTaskBody = mainTask.toString().replace(/function[\s]*\(/, `function ${mainTask.name}(`);

    const workerBody = `${asyncPresent ? `var __defProp=Object.defineProperty,__defProps=Object.defineProperties,__getOwnPropDescs=Object.getOwnPropertyDescriptors,__getOwnPropSymbols=Object.getOwnPropertySymbols,__hasOwnProp=Object.prototype.hasOwnProperty,__propIsEnum=Object.prototype.propertyIsEnumerable,__knownSymbol=(e,r)=>(r=Symbol[e])?r:Symbol.for("Symbol."+e),__defNormalProp=(e,r,o)=>r in e?__defProp(e,r,{enumerable:!0,configurable:!0,writable:!0,value:o}):e[r]=o,__spreadValues=(e,r)=>{for(var o in r||={})__hasOwnProp.call(r,o)&&__defNormalProp(e,o,r[o]);if(__getOwnPropSymbols)for(var o of __getOwnPropSymbols(r))__propIsEnum.call(r,o)&&__defNormalProp(e,o,r[o]);return e},__spreadProps=(e,r)=>__defProps(e,__getOwnPropDescs(r)),__async=(e,r,o)=>new Promise((n,t)=>{var a=e=>{try{p(o.next(e))}catch(r){t(r)}},l=e=>{try{p(o.throw(e))}catch(r){t(r)}},p=e=>e.done?n(e.value):Promise.resolve(e.value).then(a,l);p((o=o.apply(e,r)).next())}),__await=function(e,r){this[0]=e,this[1]=r},__asyncGenerator=(e,r,o)=>{var n=(e,r,t,a)=>{try{var l=o[e](r),p=(r=l.value)instanceof __await,s=l.done;Promise.resolve(p?r[0]:r).then(o=>p?n("return"===e?e:"next",r[1]?{done:o.done,value:o.value}:o,t,a):t({value:o,done:s})).catch(e=>n("throw",e,t,a))}catch(y){a(y)}},t=e=>a[e]=r=>new Promise((o,t)=>n(e,r,o,t)),a={};return o=o.apply(e,r),a[__knownSymbol("asyncIterator")]=()=>a,t("next"),t("throw"),t("return"),a},__forAwait=(e,r,o)=>(r=e[__knownSymbol("asyncIterator")])?r.call(e):(e=e[__knownSymbol("iterator")](),r={},(o=(o,n)=>(n=e[o])&&(r[o]=r=>new Promise((o,t,a)=>(a=(r=n.call(e,r)).done,Promise.resolve(r.value).then(e=>o({value:e,done:a}),t)))))("next"),o("return"),r);` : ''}

    ${injectedDependencies};
    const mainTask = ${mainTaskBody};
    onmessage = async (event) => {
      try {
        const result = await mainTask(event.data);
        postMessage(result);
      } catch (error) {
        postMessage({ error: error.message });
      }
    };
  `;

    const blob = new Blob([workerBody], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < maxWorkers; i++) {
      workerPool.push(new Worker(workerUrl));
    }
  };

  const processTask = async function* (input: Stream): AsyncGenerator<any, void, unknown> {
    try {
      for await (const emission of input) {
        const worker = await getIdleWorker();
        const data = await new Promise<any>((resolve, reject) => {
          worker.onmessage = (event: MessageEvent) => {
            if (event.data.error) {
              reject(event.data.error);
            } else {
              resolve(event.data);
            }
            returnWorker(worker);
          };

          worker.onerror = (error: ErrorEvent) => {
            reject(error.message);
            returnWorker(worker);
          };

          worker.postMessage(emission.value);
        });

        yield createEmission({ value: data }); // Emit processed value sequentially
      }
    } catch (error) {
      throw error;
    }
  };

  const getIdleWorker = (): Promise<Worker> => {
    return new Promise<Worker>((resolve) => {
      const idleWorker = workerPool.shift();
      if (idleWorker) {
        resolve(idleWorker);
      } else {
        workerQueue.push(resolve);
      }
    });
  };

  const returnWorker = (worker: Worker): void => {
    if (workerQueue.length > 0) {
      const resolve = workerQueue.shift()!;
      resolve(worker);
    } else {
      workerPool.push(worker);
    }
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    workerPool.forEach(worker => worker.terminate());
    workerPool.length = 0;
    workerQueue.length = 0;
  };

  const operator = createStreamOperator('coroutine', (stream: Stream) => {
    const subject = createSubject<any>() as Subject<any> & Coroutine;

    (async () => {
      try {
        for await (const value of processTask(stream)) {
          subject.next(value);
        }
        subject.complete();
      } catch (error) {
        subject.error?.(error);
      }
    })();

    return subject;
  }) as Coroutine;

  initWorkers();

  operator.finalize = finalize;
  operator.getIdleWorker = getIdleWorker;
  operator.returnWorker = returnWorker;
  return operator;
};
