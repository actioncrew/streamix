import { AbstractStream, distinctUntilChanged, Emission } from '../lib';

// Mock implementations for testing
class TestStream extends AbstractStream {
  private index: number;
  private values: any[];

  constructor(values: any[]) {
    super();
    this.index = 0;
    this.values = values;
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

describe('distinctUntilChanged', () => {
  it('should emit values that are distinct from the previous one', (done) => {
    const testStream = new TestStream([1, 1, 2, 2, 3, 3]);
    const distinctStream = testStream.pipe(distinctUntilChanged());

    const expectedValues = [1, 2, 3];
    let index = 0;

    distinctStream.subscribe((value) => {
      expect(value).toEqual(expectedValues[index]);
      index++;
      if (index === expectedValues.length) {
        done();
      }
    });
  });

  it('should not emit consecutive identical values', (done) => {
    const testStream = new TestStream([1, 1, 2, 2, 3, 3]);
    const distinctStream = testStream.pipe(distinctUntilChanged());

    let count = 0;

    distinctStream.subscribe((value) => {
      count++;
    });

    distinctStream.isStopped.then(() => {
      expect(count).toBe(3); // Only three distinct values should be emitted
      done();
    }); // Adjust timeout based on your test stream implementation
  });

  it('should handle non-primitive values correctly', (done) => {
    const testStream = new TestStream([{ id: 1 }, { id: 1 }, { id: 2 }, { id: 2 }, { id: 3 }, { id: 3 }]);
    const distinctStream = testStream.pipe(distinctUntilChanged<{ id: number }>());

    const expectedValues = [{ id: 1 }, { id: 2 }, { id: 3 }];
    let index = 0;

    distinctStream.subscribe((value) => {
      expect(value).toEqual(expectedValues[index]);
      index++;
      if (index === expectedValues.length) {
        done();
      }
    });
  });

  it('should emit all distinct values before stopping', (done) => {
    const testStream = new TestStream([1, 1, 2, 2, 3, 3]);
    const distinctStream = testStream.pipe(distinctUntilChanged());

    const expectedValues = [1, 2, 3];
    let emittedValues: any[] = [];

    distinctStream.subscribe((value) => {
      emittedValues.push(value);
    });

    distinctStream.isStopped.then(() => {
      expect(emittedValues).toEqual(expectedValues);
      done();
    });
  });
});
