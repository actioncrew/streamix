import { Emission, Stream, switchMap } from '../lib';

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
      try {
        let emission = { value: this.values[this.index] } as Emission;
        await this.onEmission.process({emission, source: this});

        if (emission.isFailed) {
          throw emission.error;
        }
      } catch (error) {
        Function.prototype
      } finally {
        this.index++;
      }
    }
    if(!this.isStopRequested()) {
      this.isAutoComplete = true;
    }
  }
}

describe('switchMap operator', () => {
  it('should switch to new inner streams correctly', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const project = (value: number) => new MockStream([value * 10, value * 100]);

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    switchedStream.subscribe((value) => {
      results.push(value);
    });

    switchedStream.onStop.once(() => {
      expect(results).toEqual([10, 100, 20, 200, 30, 300]); // Should switch to new inner streams and emit all values
      done();
    });
  });

  it('should handle errors in inner streams', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const project = (value: number) => {
      if (value === 2) {
        throw new Error('Error in inner stream');
      }
      return new MockStream([value * 10, value * 100]);
    };

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    switchedStream.subscribe((value) => {
      results.push(value);
    });

    switchedStream.onStop.once(() => {
      expect(results).toEqual([10, 100, 30, 300]); // Should emit values from successful inner streams only
      done();
    });
  });
});
