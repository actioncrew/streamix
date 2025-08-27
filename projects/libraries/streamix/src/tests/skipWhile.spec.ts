import { from, skipWhile } from '@actioncrew/streamix';

describe('skipWhile', () => {
  it('should skip values while the predicate is true', (done) => {
    const source$ = from([1, 2, 3, 4, 5]);
    const result: number[] = [];

    source$.pipe(skipWhile(val => val < 3)).subscribe({
      next: val => result.push(val),
      complete: () => {
        expect(result).toEqual([3, 4, 5]);
        done();
      },
      error: done.fail
    });
  });

  it('should emit all values if predicate is false initially', (done) => {
    const source$ = from([3, 4, 5]);
    const result: number[] = [];

    source$.pipe(skipWhile(val => val < 3)).subscribe({
      next: val => result.push(val),
      complete: () => {
        expect(result).toEqual([3, 4, 5]);
        done();
      },
      error: done.fail
    });
  });

  it('should skip all values if predicate is always true', (done) => {
    const source$ = from([1, 2, 3]);
    const result: number[] = [];

    source$.pipe(skipWhile(val => val < 10)).subscribe({
      next: val => result.push(val),
      complete: () => {
        expect(result).toEqual([]);
        done();
      },
      error: done.fail
    });
  });
});
