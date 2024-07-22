import { AbstractStream, Emission, take } from '../lib';

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
      let emission = { value: this.values[this.index] } as Emission;
      await this.emit(emission);

      if (emission.isFailed) {
        throw emission.error;
      }

      this.index++;
    }
    if(!this.isStopRequested.value) {
      this.isAutoComplete.resolve(true);
    }
  }
}

describe('take operator', () => {
  it('should take specified number of emissions', (done) => {
    const testStream = new MockStream([1, 2, 3, 4, 5]);
    const count = 3;

    const takenStream = testStream.pipe(take(count));

    let results: any[] = [];

    takenStream.subscribe((value) => {
      results.push(value);
    });

    takenStream.isStopped.then(() => {
      expect(results).toEqual([1, 2, 3]); // Should emit only the first three values
      done();
    });
  });

  it('should handle case where count is greater than number of emissions', (done) => {
    const testStream = new MockStream([1, 2]);
    const count = 5;

    const takenStream = testStream.pipe(take(count));

    let results: any[] = [];

    takenStream.subscribe((value) => {
      results.push(value);
    });

    takenStream.isStopped.then(() => {
      expect(results).toEqual([1, 2]); // Should emit all values because count is greater than number of emissions
      done();
    });
  });

  it('should handle empty stream', (done) => {
    const testStream = new MockStream([]);
    const count = 3;

    const takenStream = testStream.pipe(take(count));

    let results: any[] = [];

    takenStream.subscribe((value) => {
      results.push(value);
    });

    takenStream.isStopped.then(() => {
      expect(results).toEqual([]); // Should emit no values because the stream is empty
      done();
    });
  });
});
