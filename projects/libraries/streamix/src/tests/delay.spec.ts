import { delay, from } from '@actioncrew/streamix';

describe('DelayOperator', () => {
  it('should delay each value by the specified time', (done) => {
    const testStream = from([1, 2, 3]);
    const delayTime = 100; // 100 ms delay

    const delayedStream = testStream.pipe(delay(delayTime));

    const startTime = Date.now();
    let emitCount = 0;

    delayedStream.subscribe({
      next: () => {
        emitCount++;
        const elapsedTime = Date.now() - startTime + 5;
        expect(elapsedTime).toBeGreaterThanOrEqual(emitCount * delayTime);
      },
      complete: () => {
        expect(emitCount).toBe(3);
        done();
      }
    });
  });

  it('should stop emitting if the stream is cancelled', (done) => {
    const testStream = from([1, 2, 3]);
    const delayTime = 1000; // 100 ms delay

    const delayedStream = testStream.pipe(delay(delayTime));

    let emitCount = 0;

    let subscription = delayedStream.subscribe({
      next: () => {
        emitCount++;
        if (emitCount === 2) {
          subscription.unsubscribe();
        }
      },
      complete: () => {
        expect(emitCount).toBe(2);
        done();
      }
    });
  });

  it('should emit all values with delay before stopping', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const delayTime = 100; // 100 ms delay

    let emitCount = 0;

    const delayedStream = testStream.pipe(delay(delayTime));

    delayedStream.subscribe({
      next: () => emitCount++,
      complete: () => {
        expect(emitCount).toBe(5);
        done();
      }
    });
  });
});
