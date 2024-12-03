import { Stream } from '../abstractions';
import { CoroutineOperator } from '../operators';
import { catchAny } from '../utils';


export class ComputeStream extends Stream {
  private promise!: Promise<void>;

  constructor(private readonly task: CoroutineOperator, private readonly params: any) {
    super();
  }

  async run(): Promise<void> {

    this.promise = new Promise<void>(async (resolve, reject) => {

      const worker = await this.task.getIdleWorker();
      worker.postMessage(this.params);

      // Handle messages from the worker
      worker.onmessage = async (event: any) => {
        if(event.data.error) {
          this.task.returnWorker(worker);
          reject(event.data.error);
        } else {
          await this.onEmission.parallel({ emission: { value: event.data }, source: this });
          this.task.returnWorker(worker);
          resolve();
        }
      };

      // Handle errors from the worker
      worker.onerror = async (error: any) => {
        this.task.returnWorker(worker);
        reject(error);
      };
    });

    const [error] = await catchAny(Promise.race([this.awaitCompletion(), this.promise]));
    if(error) {
      this.onError.parallel({ error });
    } else if (this.shouldComplete()) {
      await this.promise;
    }

    return this.promise;
  }
}

export const compute = (task: CoroutineOperator, params: any) => new ComputeStream(task, params);
