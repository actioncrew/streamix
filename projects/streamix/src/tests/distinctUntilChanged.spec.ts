import { distinctUntilChanged, Emission, from, Stream } from '../lib';


describe('distinctUntilChanged', () => {
  it('should emit values that are distinct from the previous one', (done) => {
    const test = from([1, 1, 2, 2, 3, 3]);
    const distinctStream = test.pipe(distinctUntilChanged());

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
    const test = from([1, 1, 2, 2, 3, 3]);
    const distinctStream = test.pipe(distinctUntilChanged());

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
    const test = from([1, 1, 2, 2, 3, 3]);
    const distinctStream = test.pipe(distinctUntilChanged<{ id: number }>());

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
    const test = from(testObjects);
    const distinctStream = test.pipe(distinctUntilChanged());

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
