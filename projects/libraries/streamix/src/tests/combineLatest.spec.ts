import { combineLatest, from, Subscription, timer } from '@actioncrew/streamix';

describe('CombineLatestStream with TimerStreams', () => {
  it('should combine timer streams correctly', (done) => {
    const firstTimer = timer(0, 50);
    const secondTimer = timer(25, 50);

    const combinedTimers = combineLatest([firstTimer, secondTimer]);
    const expectedValues = [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ];

    let index = 0;

    let subscription = combinedTimers.subscribe({
      next: (latestValues: any) => {
        try {
          expect(latestValues).toEqual(expectedValues[index]);
          index++;

          if (index === expectedValues.length) {
            subscription.unsubscribe();
            done();
          }
        } catch (error) {
          subscription.unsubscribe();
          fail(error);
        }
      },
      error: (error) => {
        subscription.unsubscribe();
        fail(error);
      },
    });
  });

  it('should stop emitting values after cancellation', (done) => {
    const firstTimer = timer(0, 50);
    const secondTimer = timer(25, 50);

    const combinedTimers = combineLatest([firstTimer, secondTimer]);

    const subscription: Subscription = combinedTimers.subscribe({
      next: () => subscription.unsubscribe(),
      complete: () => done(),
    });
  });

  it('should handle completion of one stream', (done) => {
    const firstTimer = timer(0, 50);
    const secondTimer = timer(25, 50);

    const combinedTimers = combineLatest([firstTimer, secondTimer]);
    const expectedValues = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];

    let index = 0;

    const subscription = combinedTimers.subscribe({
      next: (latestValues: any) => {
        try {
          expect(latestValues).toEqual(expectedValues[index]);
          index++;

          if (index === expectedValues.length) {
            subscription.unsubscribe();
            done();
          }
        } catch (error) {
          fail(error);
        }
      },
      error: (error) => {
        subscription.unsubscribe();
        fail(error);
      },
    });
  });

  it('should combine multiple streams correctly', (done) => {
    const firstTimer = timer(0, 500);
    const secondTimer = timer(250, 500);
    const thirdTimer = timer(100, 500);

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

    const subscription = combinedTimers.subscribe({
      next: (latestValues: any) => {
        try {
          expect(latestValues).toEqual(expectedValues[index]);
          index++;

          if (index === expectedValues.length) {
            subscription.unsubscribe();
            done();
          }
        } catch (error) {
          subscription.unsubscribe();
          fail(error);
        }
      },
      error: (error) => {
        subscription.unsubscribe();
        fail(error);
      },
    });
  });

  it('should combine from streams and complete after the third emission', (done) => {
    const firstStream = from([0, 1, 2]);
    const secondStream = from([0, 1, 2]);
    const combinedStream = combineLatest([firstStream, secondStream]);
    let nextCalled = false;

    const subscription = combinedStream.subscribe({
      next: () => (nextCalled = true),
      complete: () => {
        subscription.unsubscribe();
        expect(nextCalled).toBe(true);
        done();
      },
    });
  });
});
