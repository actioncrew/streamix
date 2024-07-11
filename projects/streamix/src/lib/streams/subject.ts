import { Emission } from '../abstractions/emission';
import { AbstractStream } from '../abstractions/stream';
import { Promisified } from '../utils/promisified';

export class Subject extends AbstractStream {
  private emissionQueue: Emission[] = [];
  private emissionAvailable = new Promisified<boolean>(false);

  async run(): Promise<void> {
    try {
      while (!this.isStopped.value && !this.isUnsubscribed.value) {
        await Promise.race([this.isUnsubscribed.promise, this.emissionAvailable.promise]);

        if (this.isStopped.value || this.isUnsubscribed.value) break;

        this.emissionAvailable.reset();

        while (this.emissionQueue.length > 0) {
          if (this.isCancelled.value || this.isUnsubscribed.value) {
            this.emissionQueue = []; // Clear the queue
            this.isStopped.resolve(true);
            break;
          }

          const emission = this.emissionQueue.shift()!;
          await super.emit(emission);

          if (this.isStopRequested.value && this.emissionQueue.length === 0) {
            this.isStopped.resolve(true);
            break;
          }
        }
      }
    } catch (error: any) {
      console.warn(`Error in Subject ${this.constructor.name} run:`, error);
    }
  }

  next(value: any): void {
    if (this.isStopped.value) {
      console.warn('Cannot push value to a stopped Subject.');
      return;
    }

    if (!this.isStopRequested.value && !this.isCancelled.value) {
      this.emissionQueue.push({ value });
      this.emissionAvailable.resolve(true);
    }
  }
}
