import {catchError, Emission, endWith, finalize, from, startWith, Stream, tap } from '../lib';


describe('tap operator', () => {
  it('should perform side effects for each emission', (done) => {
    const testStream = from([1, 2, 3]);
    const sideEffectFn = jest.fn();

    const tappedStream = testStream.pipe(tap(sideEffectFn));

    let results: any[] = [];

    tappedStream.subscribe((value) => {
      results.push(value);
    });

    tappedStream.onStop.once(() => {
      console.log(tappedStream);
      // Check if side effect function was called for each emission
      expect(sideEffectFn).toHaveBeenCalledTimes(5);

      // Verify that the side effect function received the correct values
      expect(sideEffectFn).toHaveBeenCalledWith(1);
      expect(sideEffectFn).toHaveBeenCalledWith(2);
      expect(sideEffectFn).toHaveBeenCalledWith(3);

      // Ensure that the emitted results are the same as the original stream
      expect(results).toEqual([0, 1, 2, 3, 4]);

      done();
    });
  });
});
