import { AbstractStream, filter, mergeMap } from '../lib';

// Mock AbstractStream implementation for testing purposes
class MockStream extends AbstractStream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

  override async run(): Promise<void> {
    try {
      while (this.index < this.values.length && !this.isStopRequested.value) {
        await this.emit({ value: this.values[this.index] });
        this.index++;
      }
      this.isAutoComplete.resolve(true);
    } catch (error) {
      console.error('Error in MockStream:', error);
      // Handle errors appropriately in your testing environment
    } finally {
      this.isStopRequested.resolve(true);
    }
  }
}

describe('mergeMap operator', () => {
  it('should merge emissions from inner streams correctly', (done) => {
    const testStream = new MockStream([1, 2, 3, 4, 5]);

    const project = (value: number) => new MockStream([value, value * 2]);

    const mergedStream = testStream.pipe(mergeMap(project), filter(value => value > 3));

    let results: any[] = [];

    mergedStream.subscribe((value) => {
      results.push(value);
    });

    mergedStream.isStopped.promise.then(() => {
      expect(results).toEqual([1, 2, 2, 3, 4, 6]);
      done();
    });
  });

  it('should handle inner stream cancellation', (done) => {
    const testStream = new MockStream([1, 2, 3]);

    const project = (value: number) => {
      const innerStream = new MockStream([value, value * 2]);
      setTimeout(() => innerStream.cancel(), 10); // Cancel inner stream after a delay
      return innerStream;
    };

    const mergedStream = testStream.pipe(mergeMap(project));

    let results: any[] = [];

    mergedStream.subscribe((value) => {
      results.push(value);
    });

    mergedStream.isStopped.promise.then(() => {
      expect(results).toEqual([1, 2]); // Only first inner stream emissions should be processed
      done();
    });
  });

  it('should handle errors in inner streams', (done) => {
    const testStream = new MockStream([1, 2, 3]);

    const project = (value: number) => {
      if (value === 2) {
        throw new Error('Error in inner stream');
      }
      return new MockStream([value, value * 2]);
    };

    const mergedStream = testStream.pipe(mergeMap(project));

    let results: any[] = [];

    mergedStream.subscribe((value) => {
      results.push(value);
    });

    mergedStream.isStopped.promise.then(() => {
      expect(results).toEqual([1, new Error('Error in inner stream'), 3, 6]);
      done();
    });
  });
});
