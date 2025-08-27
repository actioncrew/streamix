import { from, takeWhile } from '@actioncrew/streamix';

describe('takeWhile operator', () => {
  it('should take emissions while predicate returns true', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const predicate = (value: number) => value < 4;

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([1, 2, 3]); // Should emit values until predicate returns false
        done();
      }
    });
  });

  it('should handle empty stream', (done) => {
    const testStream = from([]);
    const predicate = (_: any) => true; // Should never be called in an empty stream

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // Should not emit any values from an empty stream
        done();
      }
    });
  });

  it('should handle immediate false predicate', (done) => {
    const testStream = from([1, 2, 3]);
    const predicate = (value: number) => value > 3; // Predicate immediately returns false

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // Should not emit any values because predicate returns false immediately
        done();
      }
    });
  });
});
