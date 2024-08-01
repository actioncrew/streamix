import { Emission } from '../abstractions/emission';
import { AbstractStream } from '../abstractions/stream';
import { promisified } from '../utils';

export class Subject<T = void> extends AbstractStream {
  protected emissionQueue: Emission[] = [];
  protected emissionAvailable = promisified<boolean>(false);

  override async run(): Promise<void> {
    try {
      while (true) {
        await Promise.race([this.awaitCompletion(), this.awaitTermination(), this.emissionAvailable.promise]);

        if (this.emissionAvailable()) {
          this.emissionAvailable.reset();

          do {
            if (this.shouldTerminate()) {
              this.emissionQueue = [];
              break;
            }

            if (this.shouldComplete() && this.emissionQueue.length === 0) {
              break;
            }

            const emission = this.emissionQueue.shift()!;
            await super.emit(emission);
          } while (this.emissionQueue.length > 0);
        } else { break; }
      }
    } catch (error: any) {
      console.warn(`Error in Subject ${this.constructor.name} run:`, error);
    }
  }

  next(value?: T): void {
    if (this.isStopped()) {
      console.warn('Cannot push value to a stopped Subject.');
      return;
    }

    if (!this.isStopRequested() && !this.isCancelled()) {
      this.emissionQueue.push({ value });
      this.emissionAvailable.resolve(true);
    }
  }
}
