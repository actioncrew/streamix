import { createOperator, Operator } from "../abstractions";

export type Coroutine = Operator & {
  finalize: () => Promise<void>;
  processTask: (data: any) => Promise<any>;
  getIdleWorker: () => Promise<Worker>;
  returnWorker: (worker: Worker) => void;
};

let helperScriptCache: string | null = null;

import { createOperator } from "../abstractions";

export const coroutine = (main: Function, ...functions: Function[]): Operator => {
  return createOperator("coroutine", (source) => {
    const maxWorkers = navigator.hardwareConcurrency || 4;
    const workerPool: Worker[] = [];
    const waitingQueue: Array<(worker: Worker) => void> = [];
    let createdWorkersCount = 0;
    let isFinalizing = false;
    let blobUrlCache: string | null = null;

    const createWorker = async (): Promise<Worker> => {
      const injectedDependencies = functions
        .map((fn) => {
          let fnBody = fn.toString();
          fnBody = fnBody.replace(/function[\s]*\(/, `function ${fn.name}(`);
          return fnBody;
        })
        .join(';\n');

      const mainTaskBody = main
        .toString()
        .replace(/function[\s]*\(/, `function ${main.name}(`);

      const workerBody = `
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

      if (!blobUrlCache) {
        const blob = new Blob([workerBody], { type: 'application/javascript' });
        blobUrlCache = URL.createObjectURL(blob);
      }

      return new Worker(blobUrlCache, { type: 'module' });
    };

    const getIdleWorker = async (): Promise<Worker> => {
      if (workerPool.length > 0) {
        return workerPool.shift()!;
      }

      if (createdWorkersCount < maxWorkers) {
        createdWorkersCount++;
        return await createWorker();
      }

      return new Promise<Worker>((resolve) => {
        waitingQueue.push(resolve);
      });
    };

    const returnWorker = (worker: Worker): void => {
      if (waitingQueue.length > 0) {
        const resolve = waitingQueue.shift()!;
        resolve(worker);
      } else {
        workerPool.push(worker);
      }
    };

    const processTask = async (value: any): Promise<any> => {
      const worker = await getIdleWorker();
      try {
        return await new Promise<any>((resolve, reject) => {
          worker.onmessage = (event: MessageEvent) => {
            if (event.data.error) {
              reject(event.data.error);
            } else {
              resolve(event.data);
            }
          };

          worker.onerror = (error: ErrorEvent) => {
            reject(error.message);
          };

          worker.postMessage(value);
          returnWorker(worker);
        });
      } catch (error) {
        returnWorker(worker);
        throw error;
      }
    };

    const finalize = async () => {
      if (isFinalizing) return;
      isFinalizing = true;

      workerPool.forEach((worker) => worker.terminate());
      workerPool.length = 0;
      waitingQueue.length = 0;

      if (blobUrlCache) {
        URL.revokeObjectURL(blobUrlCache);
        blobUrlCache = null;
      }
    };

    return {
      async next(): Promise<IteratorResult<any>> {
        if (isFinalizing) return { done: true, value: undefined };

        const { done: sourceDone, value } = await source.next();

        if (sourceDone) {
          await finalize();
          return { done: true, value: undefined };
        }

        try {
          const processedValue = await processTask(value);
          return { done: false, value: processedValue };
        } catch (error) {
          await finalize();
          throw error;
        }
      },

      async return(): Promise<IteratorResult<any>> {
        await finalize();
        return { done: true, value: undefined };
      },

      async throw(error?: any): Promise<IteratorResult<any>> {
        await finalize();
        throw error;
      }
    };
  });
};
