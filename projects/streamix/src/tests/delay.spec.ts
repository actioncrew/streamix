import { delay, Stream } from '../lib';

describe('DelayOperator', () => {
  it('should delay each value by the specified time', (done) => {
    const testStream = new TestStream([1, 2, 3]);
    const delayTime = 100; // 100 ms delay

    const delayedStream = testStream.pipe(delay(delayTime));

    const startTime = Date.now();
    let emitCount = 0;

    delayedStream.subscribe((value) => {
      emitCount++;
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(emitCount * delayTime);
    });

    delayedStream.onStop.once(() => {
      if (emitCount === 3) {
        done();
      } else {
        done(new Error('Not all values were emitted'));
      }
    });
  });

  it('should stop emitting if the stream is cancelled', (done) => {
    const testStream = new TestStream([1, 2, 3]);
    const delayTime = 1000; // 100 ms delay

    const delayedStream = testStream.pipe(delay(delayTime));

    let emitCount = 0;

    delayedStream.subscribe((value) => {
      emitCount++;
      if (emitCount === 2) {
        delayedStream.complete();
      }
    });

    delayedStream.onStop.once(() => {
      expect(emitCount).toBeLessThan(3);
      done();
    });
  });

  it('should emit all values with delay before stopping', (done) => {
    const testStream = new TestStream([1, 2, 3, 4, 5]);
    const delayTime = 100; // 100 ms delay

    let emitCount = 0;

    const delayedStream = testStream.pipe(delay(delayTime));

    delayedStream.subscribe((value) => {
      emitCount++;
    });

    delayedStream.onStop.once(() => {
      expect(emitCount).toBe(5);
      done();
    });
  });
});

// Assuming you have a TestStream implementation for testing purposes
class TestStream extends Stream {
  private index: number;
  private values: any[];

  constructor(values: any[]) {
    super();
    this.index = 0;
    this.values = values;
  }

  async run(): Promise<void> {

    while (this.index < this.values.length && !this.isStopRequested) {
      await this.onEmission.process({emission:{ value: this.values[this.index] }, source: this});
      this.index++;
    }
    this.isAutoComplete = true;
  }
}
