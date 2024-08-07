import { Emission, promisified, PromisifiedType, Stream } from '../../lib';

export class Subject<T = any> extends Stream<T> {
  protected emissionQueue: PromisifiedType<Emission>[] = [];
  protected emissionAvailable = promisified<boolean>(false);
  protected emissionResolver: (() => void) | null = null;

  constructor() {
    super();
  }

  override async run(): Promise<void> {
    try {
      while (!this.shouldTerminate()) {
        if (this.emissionQueue.length === 0) {
          await Promise.race([
            this.awaitCompletion(),
            this.awaitTermination(),
            this.emissionAvailable.promise()
          ]);

          // Reset emissionAvailable for next iteration
          this.emissionAvailable.reset();

          // Check termination condition again after awaiting
          if (this.shouldTerminate()) break;
        }

        // Process all available emissions
        while (this.emissionQueue.length > 0) {
          if (this.shouldTerminate()) {
            this.emissionQueue = [];
            break;
          }

          const emission = this.emissionQueue.shift()!;
          const value = emission();
          await super.emit(value, this.head!);
          emission.resolve(value);

          if (this.shouldComplete() && this.emissionQueue.length === 0) {
            return; // Exit the method if completed and queue is empty
          }
        }

        // If we should complete and there are no more emissions, exit
        if (this.shouldComplete() && this.emissionQueue.length === 0) {
          return;
        }
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

    const emission = promisified<Emission>({ value });
    this.emissionQueue.push(emission);
    if (this.emissionQueue.length === 1) {
      this.emissionAvailable.resolve(true);
    }
    return emission.then(() => Promise.resolve());
  }
}
