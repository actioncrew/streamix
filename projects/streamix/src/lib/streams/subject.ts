import { Stream } from '../../lib';
import { promisified, PromisifiedType } from '../utils/promisified';

export class Subject<T = any> extends Stream<T> {
  protected emissionAvailable: PromisifiedType<void> = promisified();
  protected buffer: PromisifiedType<T>[] = [];

  constructor() {
    super();
  }

  async run(): Promise<void> {
    while (true) {
      // Wait for the next emission or completion signal
      await Promise.race([this.emissionAvailable.promise(), this.awaitCompletion()]);

      if(!this.shouldComplete() || this.buffer.length > 0) {
        // Process each buffered value sequentially
        while (this.buffer.length > 0) {
          const promisifiedValue = this.buffer.shift()!;
          const value = promisifiedValue()!;
          await this.onEmission.process({ emission: { value }, source: this });
          promisifiedValue.resolve(value);
        }

        // Reset emissionAvailable after processing all buffered values
        if(this.shouldComplete()) {
          break;
        }

      } else { break; }
    }
  }

  async next(value?: T): Promise<void> {
    // If the stream is stopped, we shouldn't allow further emissions
    if (this.isStopRequested || this.isStopped) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    const promisifiedValue = promisified<T>(value);
    this.buffer.push(promisifiedValue);
    this.emissionAvailable.resolve();
    return promisifiedValue.then(() => Promise.resolve());
  }
}
