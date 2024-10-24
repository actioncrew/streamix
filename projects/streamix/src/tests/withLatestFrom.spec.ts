import { Emission, from, Stream, withLatestFrom } from '../lib';

describe('withLatestFrom operator', () => {
  it('should combine emissions with latest value from other stream', (done) => {
    const mainStream = from([1, 2, 3]);
    const otherStream = from(['A', 'B', 'C', 'D', 'E']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    combinedStream.onStop.once(() => {
      expect(results).toEqual([
        [1, expect.any(String)],
        [2, expect.any(String)],
        [3, expect.any(String)]
      ]);

      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[0][1]);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[1][1]);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[2][1]);
      done();
    });
  });

  it('should handle cases where other stream contains one value', (done) => {
    const mainStream = from([1, 2, 3]);
    const otherStream = from(['A']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    combinedStream.onStop.once(() => {
      expect(results).toEqual([
        [1, 'A'],
        [2, 'A'],
        [3, 'A']
      ]);
      done();
    });
  });

  it('should handle cancellation of the main stream', (done) => {
    const mainStream = from([1, 2, 3]);
    const otherStream = from(['A', 'B', 'C']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    // Cancel the main stream immediately
    combinedStream.complete();

    combinedStream.onStop.once(() => {
      expect(results).toEqual([]);
      done();
    });
  });
});
