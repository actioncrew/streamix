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

    const workerBody = `${asyncPresent ? `function __async(thisArg, _arguments, generatorFunc) {
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
    };` : ''}

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
