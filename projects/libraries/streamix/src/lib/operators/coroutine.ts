import {
  createMapper,
  Stream,
  StreamMapper,
} from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject, Subject } from '../streams';

export type Coroutine = StreamMapper & {
  finalize: () => Promise<void>;
  processTask: (data: any) => Promise<any>;
  getIdleWorker: () => Promise<Worker>;
  returnWorker: (worker: Worker) => void;
};

let helperScriptCache: string | null = null;

export const coroutine = (main: Function, ...functions: Function[]): Coroutine => {
  const maxWorkers = navigator.hardwareConcurrency || 4;
  const workerPool: Worker[] = [];
  const waitingQueue: Array<(worker: Worker) => void> = [];
  let createdWorkersCount = 0;

  let blobUrlCache: string | null = null;
  let isFinalizing = false;

  let fetchingHelperScript = false;
  let helperScriptPromise: Promise<any> | null = null;

  const asyncPresent = main.toString().includes('__async') || functions.some((fn) =>
    fn.toString().includes('__async'),
  );

  const createWorker = async (): Promise<Worker> => {
    let helperScript = '';
    if (asyncPresent) {
      // If the helper script is not cached and not being fetched, start fetching
      if (!helperScriptCache && !fetchingHelperScript) {
        fetchingHelperScript = true; // Mark fetching as in progress
        helperScriptPromise = fetch(
          'https://unpkg.com/@actioncrew/streamix@1.0.18/fesm2022/actioncrew-streamix-coroutine.mjs',
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to fetch helper script: ${response.statusText}`);
            }
            return response.text();
          })
          .then((script) => {
            helperScriptCache = script; // Cache the helper script
            return script;
          })
          .catch((error) => {
            console.error('Error fetching helper script:', error);
            throw error;
          })
          .finally(() => {
            fetchingHelperScript = false; // Reset fetching flag
          });
      }

      // If the helper script is being fetched, wait for it to complete
      if (fetchingHelperScript) {
        helperScript = await helperScriptPromise;
      } else {
        helperScript = helperScriptCache || '';
      }
    }

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

    // Only create the Blob URL once
    if (!blobUrlCache) {
      const blob = new Blob([workerBody], { type: 'application/javascript' });
      blobUrlCache = URL.createObjectURL(blob); // Cache the Blob URL
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

  const processTask = async function* (
    input: Stream,
  ): AsyncGenerator<any, void, unknown> {
    try {
      for await (const value of eachValueFrom(input)) {
        const worker = await getIdleWorker();
        try {
          const data = await new Promise<any>((resolve, reject) => {
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
          });

          yield data;
        } finally {
          returnWorker(worker);
        }
      }
    } catch (error) {
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
      URL.revokeObjectURL(blobUrlCache); // Revoke the Blob URL
      blobUrlCache = null;
    }
  };

  const operator = createMapper('coroutine', (stream: Stream) => {
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

  operator.finalize = finalize;
  operator.getIdleWorker = getIdleWorker;
  operator.returnWorker = returnWorker;
  return operator;
};
