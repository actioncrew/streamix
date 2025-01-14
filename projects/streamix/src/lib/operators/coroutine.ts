import { Emission, Operator, Stream, createEmission, createOperator, eventBus } from '../abstractions';

export type Coroutine = Operator & {
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
  let isFinalizing: boolean = false;

  // Worker initialization
  const initWorkers = () => {
    const mainTask = functions[0];
    const dependencies = functions.slice(1);

    const injectedDependencies = dependencies.map(fn => {
      let fnBody = fn.toString();
      fnBody = fnBody.replace(/function[\s]*\(/, `function ${fn.name}(`);
      return fnBody;
    }).join(';');

    const mainTaskBody = mainTask.toString().replace(/function[\s]*\(/, `function ${mainTask.name}(`);


    const workerBody = `
      function __async(thisArg, _arguments, generatorFunc) {
        return new Promise((resolve, reject) => {
          const generator = generatorFunc.apply(thisArg, _arguments || []);

          function step(nextFunc) {
            let result;
            try {
              result = nextFunc();
            } catch (error) {
              reject(error);
              return;
            }
            if (result.done) {
              resolve(result.value);
            } else {
              Promise.resolve(result.value).then(
                (value) => step(() => generator.next(value)),
                (error) => step(() => generator.throw(error))
              );
            }
          }

          step(() => generator.next());
        });
      }

      ${injectedDependencies}
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

  const handle = (emission: Emission, stream: Stream): Emission => {
    const data = emission.value; // The data to be processed by the main task
    queueMicrotask(() => processTask(data).then((data) => {
      const child = createEmission({ value: data });
      emission.link(child);
      eventBus.enqueue({ target: stream, payload: { emission: child, source: stream }, type: 'emission' });
      emission.finalize();
    }));
    emission.pending = true;
    return emission;
  };

  const processTask = async (data: any): Promise<any> => {
    const worker = await getIdleWorker();
    return new Promise<any>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent) => {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
        returnWorker(worker); // Always return the worker after task is done
      };

      worker.onerror = (error: ErrorEvent) => {
        reject(error.message);
        returnWorker(worker); // Return the worker even if an error occurs
      };

      worker.postMessage(data);
    });
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
    if (isFinalizing) { return; }
    isFinalizing = true;

    workerPool.forEach(worker => worker.terminate());
    workerPool.length = 0; // Clear the pool
    workerQueue.length = 0; // Clear the queue
  };

  const operator = createOperator('coroutine',handle) as Coroutine;
  operator.finalize = finalize;
  operator.processTask = processTask;
  operator.getIdleWorker = getIdleWorker;
  operator.returnWorker = returnWorker;

  initWorkers();
  return operator;
};
