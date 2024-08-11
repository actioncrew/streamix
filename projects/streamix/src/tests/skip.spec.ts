import { Emission, skip, Stream } from '../lib';

// Mock implementation for AbstractStream
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
      let emission = { value: this.values[this.index] } as Emission;
      await this.onEmission.process({emission, source: this});

      if (emission.isFailed) {
        throw emission.error;
      }

      this.index++;
    }
    if (!this.isStopRequested()) {
      this.isAutoComplete.resolve(true);
    }
  }
}

describe('skip operator', () => {
  it('should skip the specified number of emissions', (done) => {
    const testStream = new MockStream([1, 2, 3, 4, 5]);
    const countToSkip = 3;

    const skippedStream = testStream.pipe(skip(countToSkip));

    let results: any[] = [];

    skippedStream.subscribe((value) => {
      results.push(value);
    });

    skippedStream.isStopped.then(() => {
      expect(results).toEqual([4, 5]); // Should skip the first 3 values and emit [4, 5]
      done();
    });
  });

  it('should handle skip count larger than stream length', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const countToSkip = 5; // More than the number of values in the stream

    const skippedStream = testStream.pipe(skip(countToSkip));

    let results: any[] = [];

    skippedStream.subscribe((value) => {
      results.push(value);
    });

    skippedStream.isStopped.then(() => {
      expect(results).toEqual([]); // Should skip all values, resulting in an empty array
      done();
    });
  });

  it('should handle skip count of zero', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const countToSkip = 0;

    const skippedStream = testStream.pipe(skip(countToSkip));

    let results: any[] = [];

    skippedStream.subscribe((value) => {
      results.push(value);
    });

    skippedStream.isStopped.then(() => {
      expect(results).toEqual([1, 2, 3]); // Should emit all values without skipping
      done();
    });
  });
});
