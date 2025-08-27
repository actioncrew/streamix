import { from, slidingPair } from "@actioncrew/streamix";


describe('slidingPair Operator', () => {
  it('should emit pairs of consecutive values', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const pairedStream = testStream.pipe(slidingPair());

    const expectedValues = [
      [undefined, 1],
      [1, 2],
      [2, 3],
      [3, 4]
    ];
    let index = 0;

    pairedStream.subscribe({
      next: (value) => {
        expect(value).toEqual(expectedValues[index]);
        index++;
        if (index === expectedValues.length) {
          done();
        }
      },
      error: (err) => done.fail(err),
    });
  });

  it('should handle a stream with a single value', (done) => {
    const testStream = from([1]);
    const pairedStream = testStream.pipe(slidingPair());

    const expectedValues = [
      [undefined, 1]
    ];
    let index = 0;

    pairedStream.subscribe({
      next: (value) => {
        expect(value).toEqual(expectedValues[index]);
        index++;
        if (index === expectedValues.length) {
          done();
        }
      },
      error: (err) => done.fail(err),
    });
  });

  it('should handle an empty stream', (done) => {
    const testStream = from([]);
    const pairedStream = testStream.pipe(slidingPair());

    let emitted = false;

    pairedStream.subscribe({
      next: () => {
        emitted = true;
      },
      complete: () => {
        expect(emitted).toBe(false);
        done();
      },
      error: (err) => done.fail(err),
    });
  });
});
