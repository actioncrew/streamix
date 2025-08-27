import { from, withLatestFrom } from '@actioncrew/streamix';

describe('withLatestFrom operator', () => {
  it('should handle cancellation of the main stream', (done) => {
    const mainStream = from([1, 2, 3]);
    const otherStream = from(['A', 'B', 'C']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    const subscription = combinedStream.subscribe({
      next: (value) => results.push(value),
      error: done.fail,
      complete: () => {
        expect(results).toEqual([]);
        done();
      },
    });

    subscription.unsubscribe();
  });

  it('should combine emissions with latest value from other stream', (done) => {
    const mainStream = from([1, 2, 3]);
    const otherStream = from(['A', 'B', 'C', 'D', 'E']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([
          [1, jasmine.any(String)],
          [2, jasmine.any(String)],
          [3, jasmine.any(String)],
        ]);

        expect(['A', 'B', 'C', 'D', 'E']).toContain(results[0][1]);
        expect(['A', 'B', 'C', 'D', 'E']).toContain(results[1][1]);
        expect(['A', 'B', 'C', 'D', 'E']).toContain(results[2][1]);
        done();
      },
      error: done.fail,
    });
  });

  it('should handle cases where other stream contains one value', (done) => {
    const mainStream = from([1, 2, 3]);
    const otherStream = from(['A']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([
          [1, 'A'],
          [2, 'A'],
          [3, 'A'],
        ]);
        done();
      },
      error: done.fail,
    });
  });
});
