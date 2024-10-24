import { from, switchMap } from '../lib';

describe('switchMap operator', () => {
  it('should switch to new inner streams correctly', (done) => {
    const testStream = from([1, 2, 3]);
    const project = (value: number) => from([value * 10, value * 100]);

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    switchedStream.subscribe((value) => {
      results.push(value);
    });

    switchedStream.onStop.once(() => {
      expect(results).toEqual([10, 100, 20, 200, 30, 300]); // Should switch to new inner streams and emit all values
      done();
    });
  });

  it('should handle errors in inner streams', (done) => {
    const testStream = from([1, 2, 3]);
    const project = (value: number) => {
      if (value === 2) {
        throw new Error('Error in inner stream');
      }
      return from([value * 10, value * 100]);
    };

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    switchedStream.subscribe((value) => {
      results.push(value);
    });

    switchedStream.onStop.once(() => {
      expect(results).toEqual([10, 100, 30, 300]); // Should emit values from successful inner streams only
      done();
    });
  });
});
