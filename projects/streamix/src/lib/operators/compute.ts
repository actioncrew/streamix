import { Emission, Operator, Stream, Subscribable } from '../abstractions';

export class DefineOperator extends Operator {
  functions: Function[];
  boundStream!: Stream;
  worker!: Worker;
  blob!: Blob;

  constructor(...functions: Function[]) {
    super();
    console.log(navigator.hardwareConcurrency);
    this.functions = functions;
  }

  callback(params?: any): void | Promise<void> {
    if(this.worker) {
      this.worker.terminate();
    }
  }

  init(): DefineOperator {
    if (this.functions.length === 0) {
      throw new Error("At least one function (the main task) is required.");
    }

    const [mainTask, ...dependencies] = this.functions;

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

    this.blob = new Blob([workerBody], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(this.blob));

    return this;
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    throw new Error("This operator should not be called within pipeline.");
  }
}

export const define = (...functions: Function[]) => new DefineOperator(...functions).init();

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
      this.promise = new Promise<void>((resolve, reject) => {
        terminateResolve = () => resolve();
        if (this.isRunning()) {
          this.task.worker.postMessage(this.params);
          this.task.worker.onmessage = async (event) => {
            await this.emit({ value: event.data }, this.head!);
            resolve();
          };
          this.task.worker.onerror = async (error) => {
            await this.emit({ isFailed: true, error }, this.head!);
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
