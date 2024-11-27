import { combineLatest, timer } from '../lib';

describe('CombineLatestStream with TimerStreams', () => {
  it('should combine timer streams correctly', (done) => {
    const firstTimer = timer(0, 50); // emit 0, 1, 2... every 50ms, starting immediately
    const secondTimer = timer(25, 50); // emit 0, 1, 2... every 50ms, starting 25ms from now

    const combinedTimers = combineLatest([firstTimer, secondTimer]);
    const expectedValues = [
      [0, 0], // at t = 25ms
      [1, 0], // at t = 50ms
      [1, 1], // at t = 75ms
      [2, 1], // at t = 100ms
      [2, 2]  // at t = 125ms
    ];

    let index = 0;

    let subscription = combinedTimers.subscribe((latestValues: any) => {
      try {
        expect(latestValues).toEqual(expectedValues[index]);
        index++;

        if (index === expectedValues.length) {
          subscription.unsubscribe();
          done();
        }
      } catch (error) {
        subscription.unsubscribe();
        done(error);
      }
    });
  });

  it('should stop emitting values after cancellation', (done) => {
    const firstTimer = timer(0, 50); // emit 0, 1, 2... every 50ms, starting immediately
    const secondTimer = timer(25, 50); // emit 0, 1, 2... every 50ms, starting 25ms from now

    const combinedTimers = combineLatest([firstTimer, secondTimer]);

    const subscription = combinedTimers.subscribe({
      next: value => subscription.unsubscribe(),
      complete: () => done()
    });
  });

  it('should handle completion of one stream', (done) => {
    const firstTimer = timer(0, 50); // emit 0, 1, 2... every 50ms, starting immediately
    const secondTimer = timer(25, 50); // emit 0, 1, 2... every 50ms, starting 25ms from now

    const combinedTimers = combineLatest([firstTimer, secondTimer]);
    const expectedValues = [
      [0, 0], // at t = 25ms
      [1, 0], // at t = 50ms
      [1, 1], // at t = 75ms
    ];

    let index = 0;

    const subscription = combinedTimers.subscribe((latestValues: any) => {
      try {
        expect(latestValues).toEqual(expectedValues[index]);
        index++;

        if (index === expectedValues.length) {
          subscription.unsubscribe();
          done();
        }
      } catch (error) {
        done(error);
      }
    });
  });

  it('should combine multiple streams correctly', (done) => {
    const firstTimer = timer(0, 500); // emit 0, 1, 2... every 50ms, starting immediately
    const secondTimer = timer(250, 500); // emit 0, 1, 2... every 50ms, starting 25ms from now
    const thirdTimer = timer(100, 500); // emit 0, 1, 2... every 50ms, starting 10ms from now

    const combinedTimers = combineLatest([firstTimer, secondTimer, thirdTimer]);
    const expectedValues = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [2, 1, 1],
      [2, 1, 2],
    ];

    let index = 0;

    const subscription = combinedTimers.subscribe((latestValues: any) => {
      try {
        expect(latestValues).toEqual(expectedValues[index]);
        index++;

        if (index === expectedValues.length) {
          subscription.unsubscribe();
          done();
        }
      } catch (error) {
        subscription.unsubscribe();
        done(error);
      }
    });
  });
});
