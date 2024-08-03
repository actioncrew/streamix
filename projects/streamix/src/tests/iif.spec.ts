import { Emission, iif, Stream } from '../lib';

// Mock implementations for testing
class MockStream extends Stream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

  override async run(): Promise<void> {
    while (this.index < this.values.length && !this.isStopRequested()) {
      await this.emit({ value: this.values[this.index] }, this.head!);
      this.index++;
    }
    this.isAutoComplete.resolve(true);

  }
}

describe('iif operator', () => {
  it('should choose trueStream when condition is true', (done) => {
    const condition = (emission: Emission) => emission.value > 5;
    const trueStream = new MockStream([10, 20, 30]);
    const falseStream = new MockStream([1, 2, 3]);

    const operator = new MockStream([10]).pipe(iif(condition, trueStream, falseStream));
    const result: any[] = [];

    const subscription = operator.subscribe((value) => {
      result.push(value);
    });

    operator.isStopped.then(() => {
      expect(result).toEqual([10, 20, 30]);
      subscription.unsubscribe();
      done();
    });
  });

  it('should choose falseStream when condition is false', (done) => {
    const condition = (emission: Emission) => emission.value > 5;
    const trueStream = new MockStream([10, 20, 30]);
    const falseStream = new MockStream([1, 2, 3]);

    const operator = new MockStream([2]).pipe(iif(condition, trueStream, falseStream));
    const result: any[] = [];

    const subscription = operator.subscribe((value) => {
      result.push(value);
    });

    operator.isStopped.then(() => {
      expect(result).toEqual([1, 2, 3]);
      subscription.unsubscribe();
      done();
    });
  });
});
