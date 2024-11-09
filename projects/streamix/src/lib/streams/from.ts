import { Emission } from '../abstractions';
import { Stream } from '../abstractions';

export class FromStream<T = any> extends Stream<T> {
  private done: boolean = false;

  constructor(private readonly iterator: Iterator<any> | AsyncIterator<any>, private readonly isAsync: boolean) {
    super();
  }

  async run(): Promise<void> {
    while (!this.done && !this.shouldComplete()) {
      // Get the next item from the iterator, using `await` if it's an async iterator
      const result = this.isAsync ? await (this.iterator as AsyncIterator<any>).next() : (this.iterator as Iterator<any>).next();

      const { value, done } = result;
      if (done) {
        this.done = true;
        if (!this.shouldComplete()) {
          this.isAutoComplete = true;
        }
      } else {
        let emission = { value } as Emission;
        await this.onEmission.parallel({ emission, source: this });

        if (emission.isFailed) {
          throw emission.error;
        }
      }
    }
  }
}

export function from<T = any>(input: any[] | Iterable<any> | AsyncIterable<any>) {
  let source: any = input;
  if (Array.isArray(input)) {
    // Convert array to a synchronous iterator
    return new FromStream<T>(source[Symbol.iterator](), false);
  } else if (typeof source[Symbol.asyncIterator] === 'function') {
    // Async iterable
    return new FromStream<T>(source[Symbol.asyncIterator](), true);
  } else if (typeof source[Symbol.iterator] === 'function') {
    // Sync iterable
    return new FromStream<T>(source[Symbol.iterator](), false);
  } else {
    throw new TypeError('Input must be an array, iterable, or async iterable');
  }
}
