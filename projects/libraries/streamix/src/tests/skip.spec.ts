import { from, skip } from '@actioncrew/streamix';

describe('skip operator', () => {
  it('should skip the specified number of emissions', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const countToSkip = 3;

    const skippedStream = testStream.pipe(skip(countToSkip));

    let results: any[] = [];

    skippedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([4, 5]); // Should skip the first 3 values and emit [4, 5]
        done();
      }
    });
  });

  it('should handle skip count larger than stream length', (done) => {
    const testStream = from([1, 2, 3]);
    const countToSkip = 5; // More than the number of values in the stream

    const skippedStream = testStream.pipe(skip(countToSkip));

    let results: any[] = [];

    skippedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // Should skip all values, resulting in an empty array
        done();
      }
    });
  });

  it('should handle skip count of zero', (done) => {
    const testStream = from([1, 2, 3]);
    const countToSkip = 0;

    const skippedStream = testStream.pipe(skip(countToSkip));

    let results: any[] = [];

    skippedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([1, 2, 3]); // Should emit all values without skipping
        done();
      }
    });
  });
});
