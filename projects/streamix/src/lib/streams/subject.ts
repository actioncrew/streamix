import { Stream } from '../../lib';

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable = Promise.resolve();

  constructor() {
    super();
  }

  override async run(): Promise<void> {
    await Promise.race([
      this.awaitCompletion(),
      this.awaitTermination(),
    ]);

    this.shouldTerminate() ? Promise.resolve() : await this.isRunning.then(() => (() => this.emissionAvailable)());
  }

  async next(value?: T): Promise<void> {
    if (this.isStopped()) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    this.emissionAvailable = (() => this.emissionAvailable.then(() => this.emit({ value }, this.head!)))();
    return this.emissionAvailable;
  }
}
