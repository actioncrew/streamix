import { Stream } from '../abstractions';

export class DefineOperator {
  private workerPool: Worker[] = [];
  private workerQueue: Array<(worker: Worker) => void> = [];
  private maxWorkers: number = navigator.hardwareConcurrency || 4;

  constructor(...functions: Function[]) {
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
        const result = mainTask(event.data);
        postMessage(result);
      };
    `;

    const blob = new Blob([workerBody], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < this.maxWorkers; i++) {
      this.workerPool.push(new Worker(workerUrl));
    }
  }

  public getIdleWorker(): Promise<Worker> {
    return new Promise<Worker>((resolve) => {
      const idleWorker = this.workerPool.shift();
      if (idleWorker) {
        resolve(idleWorker);
      } else {
        // If no workers are available, add the resolver to the queue
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
}

export const define = (...functions: Function[]) => new DefineOperator(...functions);

export class ComputeStream extends Stream {
  private task: DefineOperator;
  private params: any;
  private promise!: Promise<void>;

  constructor(task: DefineOperator, params: any) {
    super();
    this.params = params;
    this.task = task;
  }

  override async run(): Promise<void> {
    let terminateResolve: (() => void) = () => {};

    try {
      this.promise = new Promise<void>(async (resolve, reject) => {
        terminateResolve = () => resolve();
        if (this.isRunning()) {
          const worker = await this.task.getIdleWorker();
          worker.postMessage(this.params);
          worker.onmessage = async (event) => {
            await this.emit({ value: event.data }, this.head!);
            this.task.returnWorker(worker);
            resolve();
          };
          worker.onerror = async (error) => {
            await this.emit({ isFailed: true, error }, this.head!);
            this.task.returnWorker(worker);
            reject(error);
          };
        } else {
          resolve();
        }
      });

      await Promise.race([
        this.awaitCompletion(),
        this.awaitTermination(),
        this.promise,
      ]);
    } catch (error) {
      console.warn('Error during computation:', error);
    } finally {
      if (this.shouldTerminate()) {
        terminateResolve();
        await this.complete();
        return;
      }
      if (this.shouldComplete()) {
        await this.promise;
        await this.complete();
        return;
      }
    }
  }
}

export const compute = (task: DefineOperator, params: any) => new ComputeStream(task, params);
