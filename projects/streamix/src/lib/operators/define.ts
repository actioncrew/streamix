import { Emission, Operator, Subscribable } from '../abstractions';

export class DefineOperator extends Operator {
  private workerPool: Worker[] = [];
  private workerQueue: Array<(worker: Worker) => void> = [];
  private maxWorkers: number = navigator.hardwareConcurrency || 4;

  constructor(...functions: Function[]) {
    super();
    if (functions.length === 0) {
      throw new Error("At least one function (the main task) is required.");
    }

    const [mainTask, ...dependencies] = functions;

    const injectedDependencies = dependencies.map(fn => {
      let fnBody = fn.toString();
      fnBody = fnBody.replace(/function[\s]*\(/, `function ${fn.name}(`);
      return fnBody;
    }).join(';');

    const mainTaskBody = mainTask.toString().replace(/function[\s]*\(/, `function ${mainTask.name}(`);

    const workerBody = `
      ${injectedDependencies}
      const mainTask = ${mainTaskBody};
      onmessage = (event) => {
        try {
          const result = mainTask(event.data);
          postMessage(result);
        } catch (error) {
          postMessage({ error: error.message });
        }
      };
    `;

    const blob = new Blob([workerBody], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < this.maxWorkers; i++) {
      this.workerPool.push(new Worker(workerUrl));
    }
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    throw new Error("This operator should not be called within pipeline. Place it right before.");
  }

  public getIdleWorker(): Promise<Worker> {
    return new Promise<Worker>((resolve) => {
      const idleWorker = this.workerPool.shift();
      if (idleWorker) {
        resolve(idleWorker);
      } else {
        this.workerQueue.push(resolve);
      }
    });
  }

  public returnWorker(worker: Worker): void {
    // Return the worker to the pool and resolve the next promise in the queue, if any
    if (this.workerQueue.length > 0) {
      const resolve = this.workerQueue.shift()!;
      resolve(worker);
    } else {
      this.workerPool.push(worker);
    }
  }

  public async processTask(data: any): Promise<any> {
    const worker = await this.getIdleWorker();
    return new Promise<any>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent) => {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
        this.returnWorker(worker); // Always return the worker after task is done
      };

      worker.onerror = (error: ErrorEvent) => {
        reject(error.message);
        this.returnWorker(worker); // Return the worker even if an error occurs
      };

      worker.postMessage(data);
    });
  }

  override async finalize(): Promise<void> {
    // Terminate all workers and clear the pool and queue
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];
    this.workerQueue = [];
  }
}

export const define = (...functions: Function[]) => new DefineOperator(...functions);
