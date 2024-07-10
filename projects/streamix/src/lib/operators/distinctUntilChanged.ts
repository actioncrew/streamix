import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class DistinctUntilChangedOperator extends AbstractOperator {
  private lastEmittedValue: any;

  constructor() {
    super();
    this.lastEmittedValue = undefined;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<any> {
    if (this.lastEmittedValue === undefined || emission.value !== this.lastEmittedValue) {
      this.lastEmittedValue = emission.value;
      return this.next?.process(emission, stream);
    } else {
      emission.isPhantom = true;
      return;
    }
  }
}

export function distinctUntilChanged<T>(): (source: AbstractStream) => AbstractStream {
  return (source: AbstractStream) => {
    const distinctUntilChangedOperator = new DistinctUntilChangedOperator();
    source.pipe(distinctUntilChangedOperator);
    return source;
  };
}
