import { createSubject, from, zip } from '@actioncrew/streamix';

describe('zip operator', () => {
  it('should zip values from multiple streams', (done) => {
    const stream1$ = from([1, 2, 3]);
    const stream2$ = from(['a', 'b', 'c']);
    const stream3$ = from([true, false, true]);

    const result: any[] = [];
    zip([stream1$, stream2$, stream3$]).subscribe({
      next: (value: any) => result.push(value),
      complete: () => {
        expect(result).toEqual([
          [1, 'a', true],
          [2, 'b', false],
          [3, 'c', true],
        ]);
        done();
      },
      error: (err: any) => done.fail(err),
    });
  });

  it('should complete when one source is empty', (done) => {
    const stream1$ = from([] as any[]);
    const stream2$ = from(['a', 'b', 'c']);
    const stream3$ = from([true, false, true]);

    const result: any[] = [];
    zip([stream1$, stream2$, stream3$]).subscribe({
      next: () => done.fail('Should not emit any values'),
      complete: () => {
        expect(result).toEqual([]);
        done();
      },
      error: (err: any) => done.fail(err),
    });
  });

  it('should zip until the shortest stream completes', (done) => {
    const stream1$ = from([1, 2]);
    const stream2$ = from(['a', 'b', 'c']);
    const stream3$ = from([true, false, true, false]);

    const result: any[] = [];
    zip([stream1$, stream2$, stream3$]).subscribe({
      next: (value: any) => result.push(value),
      complete: () => {
        expect(result).toEqual([
          [1, 'a', true],
          [2, 'b', false],
        ]);
        done();
      },
      error: (err: any) => done.fail(err),
    });
  });

  it('should handle sources that emit values asynchronously', (done) => {
    const stream1$ = createSubject<number>();
    const stream2$ = createSubject<string>();
    const stream3$ = createSubject<boolean>();

    const result: any[] = [];
    zip([stream1$, stream2$, stream3$]).subscribe({
      next: (value: any) => result.push(value),
      complete: () => {
        expect(result).toEqual([
          [1, 'a', true],
          [2, 'b', false],
        ]);
        done();
      },
      error: (err: any) => done.fail(err),
    });

    setTimeout(() => {
      stream1$.next(1);
      stream2$.next('a');
      stream3$.next(true);

      stream1$.next(2);
      stream2$.next('b');
      stream3$.next(false);

      stream1$.complete();
      stream2$.complete();
      stream3$.complete();
    }, 100);
  });
});
