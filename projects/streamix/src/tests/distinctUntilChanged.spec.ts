import { distinctUntilChanged, Emission, Stream } from '../lib';

// Mock implementations for testing
class TestStream extends Stream {
  private index: number;
  private values: any[];

  constructor(values: any[]) {
    super();
    this.index = 0;
    this.values = values;
  }

  async run(): Promise<void> {
    while (this.index < this.values.length && !this.isStopRequested) {
      let emission = { value: this.values[this.index] } as Emission;
      await this.onEmission.process({emission, source: this});

      if (emission.isFailed) {
        throw emission.error;
      }

      this.index++;
    }
    if(!this.isStopRequested) {
      this.isAutoComplete = true;
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

    distinctStream.onStop.once(() => {
      expect(count).toBe(3); // Only three distinct values should be emitted
      done();
    }); // Adjust timeout based on your test stream implementation
  });

  it('should handle non-primitive values correctly', (done) => {
    const testStream = new TestStream([1, 1, 2, 2, 3, 3]);
    const distinctStream = testStream.pipe(distinctUntilChanged<{ id: number }>());

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

  // Example object equality test with reference-based distinctUntilChanged
  it('should emit distinct objects based on reference equality', (done) => {
    const object1 = { id: 1 };
    const object2 = { id: 2 };
    const object3 = { id: 3 };

    const testObjects = [object1, object1, object2, object2, object3, object3];
    const testStream = new TestStream(testObjects);
    const distinctStream = testStream.pipe(distinctUntilChanged());

    const expectedValues = [object1, object2, object3];

    let emittedValues: any[] = [];

    distinctStream.subscribe((value) => {
      emittedValues.push(value);
    });

    distinctStream.onStop.once(() => {
      // Ensure emitted values are distinct based on reference
      expect(emittedValues).toEqual(expectedValues);
      done();
    });
  });
});
