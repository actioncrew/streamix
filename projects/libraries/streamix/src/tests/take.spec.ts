import { from, take } from '@actioncrew/streamix';

describe('take operator', () => {
  it('should take specified number of emissions', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const count = 3;

    const takenStream = testStream.pipe(take(count));

    let results: any[] = [];

    takenStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([1, 2, 3]); // Should emit only the first three values
        done();
      }
    });
  });

  it('should handle case where count is greater than number of emissions', (done) => {
    const testStream = from([1, 2]);
    const count = 5;

    const takenStream = testStream.pipe(take(count));

    let results: any[] = [];

    takenStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([1, 2]); // Should emit all values because count is greater than number of emissions
        done();
      }
    });
  });

  it('should handle empty stream', (done) => {
    const testStream = from([]);
    const count = 3;

    const takenStream = testStream.pipe(take(count));

    let results: any[] = [];

    takenStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // Should emit no values because the stream is empty
        done();
      }
    });
  });
});
