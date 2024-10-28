import { from, scan } from '../lib';

describe('scan operator', () => {
  it('should accumulate values correctly', (done) => {
    const testStream = from([1, 2, 3]);
    const accumulator = (acc: number, value: number) => acc + value;
    const seed = 0;

    const scannedStream = testStream.pipe(scan(accumulator, seed));

    let results: any[] = [];

    scannedStream.subscribe((value) => {
      results.push(value);
    });

    scannedStream.onStop.once(() => {
      expect(results).toEqual([1, 3, 6]);
      done();
    });
  });

  it('should handle errors in accumulation', (done) => {
    const testStream = from([1, 2, 3]);
    const accumulator = (acc: number, value: number) => {
      if (value === 2) {
        throw new Error('Error in accumulation');
      }
      return acc + value;
    };
    const seed = 0;

    const scannedStream = testStream.pipe(scan(accumulator, seed));

    let results: any[] = [];

    scannedStream.subscribe((value) => {
      results.push(value);
    });

    scannedStream.onStop.once(() => {
      expect(results).toEqual([1]); // Only the first value should be accumulated before error
      done();
    });
  });
});
