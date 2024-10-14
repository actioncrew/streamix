import { Stream } from '../abstractions';
import { Coroutine } from '../operators';


export class ComputeStream extends Stream {
  private task: Coroutine;
  private params: any;
  private promise!: Promise<void>;

  constructor(task: Coroutine, params: any) {
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
            await this.onEmission.process({ emission: { value: event.data }, source: this });
            this.task.returnWorker(worker);
            resolve();
          };
          worker.onerror = async (error) => {
            await this.onEmission.process({ emission: { isFailed: true, error }, source: this });
            this.task.returnWorker(worker);
            reject(error);
          };
        } else {
          resolve();
        }
      });

      await Promise.race([
        this.awaitCompletion(),
        this.promise,
      ]);
    } catch (error) {
      console.warn('Error during computation:', error);
    } finally {
      if (this.shouldComplete()) {
        await this.promise;
        await this.complete();
        return;
      }
    }
  }
}

export const compute = (task: Coroutine, params: any) => new ComputeStream(task, params);
