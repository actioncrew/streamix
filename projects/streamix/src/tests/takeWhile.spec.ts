import { Emission, Stream, takeWhile } from '../lib';

// Mock implementation for AbstractStream
class MockStream extends Stream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

async run(): Promise<void> {
    while (this.index < this.values.length && !this.isStopRequested()) {
      let emission = { value: this.values[this.index] } as Emission;
      await this.onEmission.process({emission, source: this});

      if (emission.isFailed) {
        throw emission.error;
      }

      this.index++;
    }
    if(!this.isStopRequested()) {
      this.isAutoComplete.resolve(true);
    }
  }
}

describe('takeWhile operator', () => {
  it('should take emissions while predicate returns true', (done) => {
    const testStream = new MockStream([1, 2, 3, 4, 5]);
    const predicate = (value: number) => value < 4;

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe((value) => {
      results.push(value);
    });

    takenWhileStream.isStopped.then(() => {
      expect(results).toEqual([1, 2, 3]); // Should emit values until predicate returns false
      done();
    });
  });

  it('should handle empty stream', (done) => {
    const testStream = new MockStream([]);
    const predicate = (value: any) => true; // Should never be called in an empty stream

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe((value) => {
      results.push(value);
    });

    takenWhileStream.isStopped.then(() => {
      expect(results).toEqual([]); // Should not emit any values from an empty stream
      done();
    });
  });

  it('should handle immediate false predicate', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const predicate = (value: number) => value > 3; // Predicate immediately returns false

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe((value) => {
      results.push(value);
    });

    takenWhileStream.isStopped.then(() => {
      expect(results).toEqual([]); // Should not emit any values because predicate returns false immediately
      done();
    });
  });
});
