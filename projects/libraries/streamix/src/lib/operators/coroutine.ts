import { createOperator, Operator } from "../abstractions";

export type Coroutine = Operator & {
  finalize: () => Promise<void>;
  processTask: (data: any) => Promise<any>;
  getIdleWorker: () => Promise<Worker>;
  returnWorker: (worker: Worker) => void;
};

let helperScriptCache: string | null = null;
let fetchingHelperScript = false;
let helperScriptPromise: Promise<string> | null = null; // Corrected type to string

export const coroutine = (main: Function, ...functions: Function[]): Coroutine => {
  const maxWorkers = navigator.hardwareConcurrency || 4;
  const workerPool: Worker[] = [];
  const waitingQueue: Array<(worker: Worker) => void> = [];
  let createdWorkersCount = 0;

  let blobUrlCache: string | null = null;
  let isFinalizing = false;

  const createWorker = async (): Promise<Worker> => {
    let helperScript = '';

    const injectedDependencies = functions
      .map((fn) => {
        let fnBody = fn.toString();
        // Ensure named function expressions are properly represented
        fnBody = fnBody.replace(/function[\s]*\(/, `function ${fn.name || ''}(`);
        return fnBody;
      })
      .join(';\n');

    const mainTaskBody = main
      .toString()
      .replace(/function[\s]*\(/, `function ${main.name || ''}(`);

    const asyncPresent = mainTaskBody.includes('__async') || injectedDependencies.includes('__async');

    if (asyncPresent) {
      if (!helperScriptCache && !fetchingHelperScript) {
        fetchingHelperScript = true;
        helperScriptPromise = fetch(
          'https://unpkg.com/@actioncrew/streamix@2.0.16/fesm2022/actioncrew-streamix-coroutine.mjs',
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to fetch helper script: ${response.statusText}`);
            }
            return response.text();
          })
          .then((script) => {
            helperScriptCache = script;
            return script;
          })
          .catch((error) => {
            console.error('Error fetching helper script:', error);
            throw error;
          })
          .finally(() => {
            fetchingHelperScript = false;
          });
      }

      if (helperScriptPromise) { // Ensure helperScriptPromise is not null before awaiting
        helperScript = await helperScriptPromise;
      } else if (helperScriptCache) {
        helperScript = helperScriptCache;
      }
    }

    const workerBody = `
      ${helperScript}
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
    if (isFinalizing) { // Don't return workers if finalizing
      worker.terminate();
      return;
    }
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
        const messageHandler = (event: MessageEvent) => {
          worker.removeEventListener('message', messageHandler); // Clean up listener
          worker.removeEventListener('error', errorHandler);     // Clean up listener
          if (event.data.error) {
            reject(new Error(event.data.error)); // Wrap error string in Error object
          } else {
            resolve(event.data);
          }
        };

        const errorHandler = (error: ErrorEvent) => {
          worker.removeEventListener('message', messageHandler); // Clean up listener
          worker.removeEventListener('error', errorHandler);     // Clean up listener
          reject(new Error(error.message)); // Wrap error string in Error object
        };

        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', errorHandler);

        worker.postMessage(value);
      });
    } finally {
      returnWorker(worker); // Ensure worker is returned even on error
    }
  };

  const finalize = async () => {
    if (isFinalizing) return;
    isFinalizing = true;

    // Terminate all workers in the pool and clear waiting queue
    while(workerPool.length > 0) {
        workerPool.pop()!.terminate();
    }
    while(waitingQueue.length > 0) {
        // Resolve any pending requests with an error or by terminating the worker
        // This is a more complex scenario depending on desired behavior.
        // For simplicity, we'll just clear the queue as workers will be terminated.
        waitingQueue.pop();
    }

    if (blobUrlCache) {
      URL.revokeObjectURL(blobUrlCache);
      blobUrlCache = null;
    }
    helperScriptCache = null; // Clear helper script cache on finalize
    helperScriptPromise = null;
  };

  const operator = createOperator("coroutine", (source) => {
    return {
      async next(): Promise<IteratorResult<any>> {
        if (isFinalizing) {
          // If already finalizing, complete immediately
          return { done: true, value: undefined };
        }

        const { done: sourceDone, value } = await source.next();

        if (sourceDone) {
          await finalize(); // Finalize when source is done
          return { done: true, value: undefined };
        }

        try {
          const processedValue = await processTask(value);
          return { done: false, value: processedValue };
        } catch (error) {
          // Propagate error and finalize
          await finalize();
          throw error;
        }
      },

      async return(): Promise<IteratorResult<any>> {
        await finalize(); // Finalize on early return
        return { done: true, value: undefined };
      },

      async throw(error?: any): Promise<IteratorResult<any>> {
        await finalize(); // Finalize on error from upstream
        throw error;
      }
    };
  });

  // Attach the additional methods to the operator object
  // This is the key correction: extending the operator after its creation
  return {
    ...operator,
    finalize,
    processTask, // Expose processTask if it's meant to be called externally
    getIdleWorker, // Expose getIdleWorker if it's meant to be called externally
    returnWorker, // Expose returnWorker if it's meant to be called externally
  } as Coroutine; // Assert the type
};
