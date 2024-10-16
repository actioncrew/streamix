import { Stream } from '../../lib';

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable = Promise.resolve();

  constructor() {
    super();
  }

  async run(): Promise<void> {
    await this.awaitCompletion();

    return this.emissionAvailable;
  }

  async next(value?: T): Promise<void> {
    if (this.isStopped()) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    this.emissionAvailable = (() => this.emissionAvailable.then(() => this.onEmission.process({ emission: { value }, source: this })))();
    return this.emissionAvailable;
  }
}
