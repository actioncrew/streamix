import { combineLatest, timer } from '../lib';

describe('CombineLatestStream with TimerStreams', () => {
  it('should combine timer streams correctly', (done) => {
    const firstTimer = timer(0, 50); // emit 0, 1, 2... every second, starting immediately
    const secondTimer = timer(25, 50); // emit 0, 1, 2... every second, starting 0.5 seconds from now

    const combinedTimers = combineLatest([firstTimer, secondTimer]);
    const expectedValues = [
      [0, 0], // at t = 0.5s
      [1, 0], // at t = 1s
      [1, 1], // at t = 1.5s
      [2, 1], // at t = 2s
      [2, 2]  // at t = 2.5s
    ];

    let index = 0;

    combinedTimers.subscribe((latestValues: any) => {
      try {
        expect(latestValues).toEqual(expectedValues[index]);
        index++;

        if (index === expectedValues.length) {
          done();
        }
      } catch (error) {
        done(error);
      }
    });
  });
});
