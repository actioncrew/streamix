import { Emission } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class FromStream<T = any> extends Stream<T> {
  private done: boolean = false;

  constructor(private readonly iterator: IterableIterator<any>) {
    super();
  }

  async run(): Promise<void> {
    while (!this.done && !this.shouldComplete()) {
      const { value, done } = this.iterator.next();
      if (done) {
        this.done = true;
        if (!this.shouldComplete()) {
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
