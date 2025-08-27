import { catchError, endWith, finalize, from, startWith, tap } from '@actioncrew/streamix';

describe('tap operator', () => {
  it('should perform side effects for each emission', (done) => {
    const testStream = from([1, 2, 3]);
    const sideEffectFn = jasmine.createSpy('sideEffectFn');

    const tappedStream = testStream.pipe(startWith(0), endWith(4), tap(sideEffectFn), catchError(console.log), finalize(() => {}));

    let results: any[] = [];

    tappedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(sideEffectFn).toHaveBeenCalledTimes(5);

        expect(sideEffectFn).toHaveBeenCalledWith(0);
        expect(sideEffectFn).toHaveBeenCalledWith(1);
        expect(sideEffectFn).toHaveBeenCalledWith(2);
        expect(sideEffectFn).toHaveBeenCalledWith(3);
        expect(sideEffectFn).toHaveBeenCalledWith(4);

        expect(results).toEqual([0, 1, 2, 3, 4]);

        done();
      },
      error: done.fail,
    });
  });
});
