import { AbstractStream, Emission, takeUntil } from '../lib';

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
    try {
      while (this.index < this.values.length && !this.isStopRequested.value) {
        let emission = { value: this.values[this.index] } as Emission;
        await this.emit(emission);

        if (emission.isFailed) {
          throw emission.error;
        }

        this.index++;
      }
      this.isAutoComplete.resolve(true);
    } catch (error) {
      console.error('Error in MockStream:', error);
      this.isFailed.resolve(error);
    } finally {
      this.isStopped.resolve(true);
    }
  }
}

describe('takeUntil operator', () => {
  it('should take emissions until notifier emits', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const notifier = new MockStream(['stop']);

    const takenUntilStream = testStream.pipe(takeUntil(notifier));

    let results: any[] = [];

    takenUntilStream.subscribe((value) => {
      results.push(value);
    });

    takenUntilStream.isStopped.then(() => {
      expect(results).toEqual([1, 2, 3]); // Should emit all values before notifier emits
      done();
    });
  });

  it('should handle case where notifier emits immediately', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const notifier = new MockStream(['stop']);
    notifier.run(); // Notifier emits immediately

    const takenUntilStream = testStream.pipe(takeUntil(notifier));

    let results: any[] = [];

    takenUntilStream.subscribe((value) => {
      results.push(value);
    });

    takenUntilStream.isStopped.then(() => {
      expect(results).toEqual([]); // Should not emit any values because notifier emits immediately
      done();
    });
  });

  it('should handle empty stream', (done) => {
    const testStream = new MockStream([]);
    const notifier = new MockStream(['stop']);

    const takenUntilStream = testStream.pipe(takeUntil(notifier));

    let results: any[] = [];

    takenUntilStream.subscribe((value) => {
      results.push(value);
    });

    takenUntilStream.isStopped.then(() => {
      expect(results).toEqual([]); // Should not emit any values because the source stream is empty
      done();
    });
  });
});
