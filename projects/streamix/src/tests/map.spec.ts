import { AbstractStream, map } from '../lib';

// Mock implementation for AbstractStream
class MockStream extends AbstractStream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

  override async run(): Promise<void> {
    while (this.index < this.values.length && !this.isStopRequested.value) {
      await this.emit({ value: this.values[this.index] });
      this.index++;
    }
    this.isAutoComplete.resolve(true);
  }
}

describe('map operator', () => {
  it('should transform values correctly', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const transform = (value: number) => value * 2;

    const mappedStream = testStream.pipe(map(transform));

    let results: any[] = [];

    mappedStream.subscribe((value) => {
      results.push(value);
    });

    mappedStream.isStopped.then(() => {
      expect(results).toEqual([2, 4, 6]);
      done();
    });
  });

  it('should handle errors in transformation', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const transform = (value: number) => {
      if (value === 2) {
        throw new Error('Error in transformation');
      }
      return value * 2;
    };

    const mappedStream = testStream.pipe(map(transform));

    let results: any[] = [];

    mappedStream.subscribe((value) => {
      results.push(value);
    });

    mappedStream.isStopped.then(() => {
      expect(results).toEqual([2, 6]); // Only the first value should be emitted before error
      done();
    });
  });
});
