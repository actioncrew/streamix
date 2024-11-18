import { delay, from, switchMap } from '../lib';

describe('switchMap operator', () => {
  it('should switch to new inner streams correctly', (done) => {
    const testStream = from([1, 2, 3]).pipe(delay(100));
    const project = (value: number) => from([value * 10, value * 100]);

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    switchedStream.subscribe((value) => {
      results.push(value);
    });

    switchedStream.onStop.once(() => {
      expect(results).toEqual([30, 300]); // Should switch to new inner streams and emit all values
      done();
    });
  });
});
