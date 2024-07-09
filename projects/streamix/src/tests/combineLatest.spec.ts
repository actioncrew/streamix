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

  it('should stop emitting values after cancellation', (done) => {
    const firstTimer = timer(0, 50); // emit 0, 1, 2... every 50ms, starting immediately
    const secondTimer = timer(25, 50); // emit 0, 1, 2... every 50ms, starting 25ms from now

    const combinedTimers = combineLatest([firstTimer, secondTimer]);

    const subscription = combinedTimers.subscribe((latestValues: any) => {
      try {
        if (latestValues[0] === 1 && latestValues[1] === 1) {
          subscription.unsubscribe();
          done();
        }
      } catch (error) {
        done(error);
      }
    });

    setTimeout(() => {
      done(new Error('Stream did not cancel correctly'));
    }, 200);
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

    setTimeout(() => {
      done(new Error('Stream did not handle completion correctly'));
    }, 200);
  });

  it('should combine multiple streams correctly', (done) => {
    const firstTimer = timer(0, 50); // emit 0, 1, 2... every 50ms, starting immediately
    const secondTimer = timer(25, 50); // emit 0, 1, 2... every 50ms, starting 25ms from now
    const thirdTimer = timer(10, 50); // emit 0, 1, 2... every 50ms, starting 10ms from now

    const combinedTimers = combineLatest([firstTimer, secondTimer, thirdTimer]);
    const expectedValues = [
      [0, 0, 0], // at t = 25ms
      [1, 0, 0], // at t = 50ms
      [1, 1, 0], // at t = 75ms
      [2, 1, 0], // at t = 100ms
      [2, 2, 0], // at t = 125ms
      [2, 2, 1], // at t = 150ms
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
