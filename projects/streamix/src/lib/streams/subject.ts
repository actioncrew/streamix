import { Emission } from '../abstractions/emission';
import { AbstractStream } from '../abstractions/stream';
import { Promisified } from '../utils/promisified';

export class Subject extends AbstractStream {
  protected emissionQueue: Promisified<Emission>[] = [];
  protected hasNewValue = new Promisified<boolean>(false);

  constructor() {
    super();
  }

  async run(): Promise<void> {
    try {
      while (!this.isStopped.value && !this.isUnsubscribed.value) {
        await Promise.race([this.isUnsubscribed.promise, this.hasNewValue.promise]);

        if(!this.isStopped.value && !this.isUnsubscribed.value) {
          this.hasNewValue.reset();
        }

        while (this.emissionQueue.length > 0 && !this.isStopped.value && !this.isUnsubscribed.value) {
          if (this.isCancelled.value || this.isUnsubscribed.value) {
            this.emissionQueue.forEach(emission => emission.value.isCancelled = true);
            this.isStopped.resolve(true);
            break;
          } else {
            const promisified = this.emissionQueue.shift()!;
            const emission: Emission = promisified.value;
            await super.emit(emission);
            promisified.resolve(emission);

            if (this.isStopRequested.value && this.emissionQueue.length == 0) {
              this.isStopped.resolve(true);
              break;
            }
          }
        }
      }
    }
    catch (error: any) {
      console.warn(`Error in Subject ${this.constructor.name} run:`, error);
    }
  }

  next(value: any): Promise<void> {
    if (this.isStopped.value) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }
    if (!this.isStopRequested.value && !this.isCancelled.value) {
      const emission = new Promisified<Emission>({value});
      this.emissionQueue.push(emission);
      this.hasNewValue.resolve(true);

      return emission.promise.then(() => Promise.resolve());
    }
    return this.isStopped.promise.then(() => Promise.resolve());
  }
}
