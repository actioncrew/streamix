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

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    throw new Error("This operator should not be called within pipeline. Place it right before.");
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
