import { Stream } from '../abstractions';
import { coroutine } from '../operators';


export class ComputeStream extends Stream {
  private promise!: Promise<void>;

  constructor(private readonly task: ReturnType<typeof coroutine>, private readonly params: any) {
    super();
  }

  async run(): Promise<void> {
    let terminateResolve: (() => void) = () => {};

    try {
      this.promise = new Promise<void>(async (resolve, reject) => {
        terminateResolve = () => resolve();
        if (this.isRunning) {
          const worker = await this.task.getIdleWorker();
          worker.postMessage(this.params);
          worker.onmessage = async (event: any) => {
            await this.onEmission.process({ emission: { value: event.data }, source: this });
            this.task.returnWorker(worker);
            resolve();
          };
          worker.onerror = async (error: any) => {
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

export const compute = (task: ReturnType<typeof coroutine>, params: any) => new ComputeStream(task, params);
