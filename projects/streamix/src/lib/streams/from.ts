import { Emission } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class FromStream<T = any> extends Stream<T> {
  private readonly iterator: IterableIterator<any>;
  private done: boolean = false;

  constructor(iterator: IterableIterator<any>) {
    super();
    this.iterator = iterator;
  }

  override async run(): Promise<void> {
    try {
      while (!this.done && !this.isStopRequested()) {
        const { value, done } = this.iterator.next();
        if (done) {
          this.done = true;
          if (!this.isStopRequested()) {
            this.isAutoComplete.resolve(true);
          }
        } else {
          let emission = { value } as Emission;
          await this.onEmission.process({ emission, source: this });

          if (emission.isFailed) {
            throw emission.error;
          }
        }
      }
    } catch (error) {
      this.isFailed.resolve(error);
    }
  }
}

export function from<T = any>(input: any[] | IterableIterator<any>) {
  if (Array.isArray(input)) {
    return new FromStream<T>(input[Symbol.iterator]()); // Convert array to iterator
  } else if (typeof input[Symbol.iterator] === 'function') {
    return new FromStream<T>(input as IterableIterator<any>);
  } else {
    throw new TypeError('Input must be an array or an iterable iterator');
  }
}
