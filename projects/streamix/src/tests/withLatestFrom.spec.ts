import { Emission, Stream, withLatestFrom } from '../lib';

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
      await this.emit(emission, this.head!);

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

describe('withLatestFrom operator', () => {
  it('should combine emissions with latest value from other stream', (done) => {
    const mainStream = new MockStream([1, 2, 3]);
    const otherStream = new MockStream(['A', 'B', 'C', 'D', 'E']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    combinedStream.isStopped.then(() => {
      expect(results).toEqual([
        [1, expect.any(String)],
        [2, expect.any(String)],
        [3, expect.any(String)]
      ]);

      expect(results[0][1]).toBe('A');
      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[1][1]);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[2][1]);
      done();
    });
  });

  it('should handle cases where other stream contains one value', (done) => {
    const mainStream = new MockStream([1, 2, 3]);
    const otherStream = new MockStream(['A']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    combinedStream.isStopped.then(() => {
      expect(results).toEqual([
        [1, 'A'],
        [2, 'A'],
        [3, 'A']
      ]);
      done();
    });
  });

  it('should handle cases where other stream emits multiple times before main stream', (done) => {
    const mainStream = new MockStream([1, 2, 3]);
    const otherStream = new MockStream(['A', 'B', 'C', 'D']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    otherStream.isStopped.then(() => {
      combinedStream.subscribe((value) => {
        results.push(value);
      });
    });

    combinedStream.isStopped.then(() => {
      expect(results).toEqual([
        [1, 'D'], // Other stream emits up to 'D', then main stream emits 1
        [2, 'D'], // Main stream emits 2, other stream still emits 'D'
        [3, 'D']  // Main stream emits 3, other stream still emits 'D'
      ]);
      done();
    });
  });

  it('should handle cancellation of the main stream', (done) => {
    const mainStream = new MockStream([1, 2, 3]);
    const otherStream = new MockStream(['A', 'B', 'C']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    // Cancel the main stream immediately
    combinedStream.terminate();

    combinedStream.isStopped.then(() => {
      expect(results).toEqual([]);
      done();
    });
  });

  it('should handle cancellation of the other stream', (done) => {
    const mainStream = new MockStream([1, 2, 3]);
    const otherStream = new MockStream(['A', 'B', 'C']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    // Cancel the other stream immediately
    otherStream.terminate();

    combinedStream.isStopped.then(() => {
      expect(results).toEqual([]);
      done();
    });
  });
});
