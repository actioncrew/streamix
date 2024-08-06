import { Emission, promisified, PromisifiedType, Stream } from '../../lib';

export class Subject<T = void> extends Stream<any> {
  protected emissionQueue: PromisifiedType<Emission>[] = [];
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
            await super.emit(emission(), this.head!);
            emission.resolve(emission());
          } while (this.emissionQueue.length > 0);
        } else { break; }
      }
    } catch (error: any) {
      console.warn(`Error in Subject ${this.constructor.name} run:`, error);
    }
  }

  next(value?: T): Promise<void> {
    if (this.isStopped()) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    if (!this.isStopRequested() && !this.isCancelled()) {
      let emission = promisified<Emission>({ value });
      this.emissionQueue.push(emission);
      this.emissionAvailable.resolve(true);
      return emission.then(() => Promise.resolve());
    }

    return this.isStopped.then(() => Promise.resolve());
  }
}
