import { from, of, take, takeUntil, timer } from '@actioncrew/streamix';

describe('takeUntil operator', () => {
  it('should take emissions until notifier emits', (done) => {
    const testStream = from([1, 2, 3]);
    const notifier = timer(2000, 1000).pipe(take(1));

    const takenUntilStream = testStream.pipe(takeUntil(notifier));

    let results: any[] = [];

    takenUntilStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([1, 2, 3]); // Should emit all values before notifier emits
        done();
      }
    });
  });

  it('should handle case where notifier emits immediately', (done) => {
    const testStream = timer(0, 500);
    const notifier = of('finalize');

    const takenUntilStream = testStream.pipe(takeUntil(notifier));

    let results: any[] = [];

    takenUntilStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results.length).toEqual(0); // Should not emit any values because notifier emits immediately
        done();
      }
    });
  });

  it('should handle empty stream', (done) => {
    const testStream = from([]);
    const notifier = from(['finalize']);

    const takenUntilStream = testStream.pipe(takeUntil(notifier));

    let results: any[] = [];

    takenUntilStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // Should not emit any values because the source stream is empty
        done();
      }
    });
  });
});
