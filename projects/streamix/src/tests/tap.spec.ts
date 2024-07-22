import { AbstractStream, Emission, tap } from '../lib';

// Mock implementation for AbstractStream
class MockStream extends AbstractStream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

  override async run(): Promise<void> {
    try {
      while (this.index < this.values.length && !this.isStopRequested.value) {
        let emission = { value: this.values[this.index] } as Emission;
        await this.emit(emission);

        if (emission.isFailed) {
          throw emission.error;
        }

        this.index++;
      }
      this.isAutoComplete.resolve(true);
    } catch (error) {
      this.isFailed.resolve(error);
    }
  }
}

describe('tap operator', () => {
  it('should perform side effects for each emission', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const sideEffectFn = jest.fn();

    const tappedStream = testStream.pipe(tap(sideEffectFn));

    let results: any[] = [];

    tappedStream.subscribe((value) => {
      results.push(value);
    });

    tappedStream.isStopped.then(() => {
      console.log(tappedStream);
      // Check if side effect function was called for each emission
      expect(sideEffectFn).toHaveBeenCalledTimes(3);

      // Verify that the side effect function received the correct values
      expect(sideEffectFn).toHaveBeenCalledWith(1);
      expect(sideEffectFn).toHaveBeenCalledWith(2);
      expect(sideEffectFn).toHaveBeenCalledWith(3);

      // Ensure that the emitted results are the same as the original stream
      expect(results).toEqual([1, 2, 3]);

      done();
    });
  });

  it('should handle errors in the side effect function', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const sideEffectFn = jest.fn().mockImplementation(() => {
      throw new Error('Error in side effect');
    });

    const tappedStream = testStream.pipe(tap(sideEffectFn));

    let results: any[] = [];

    tappedStream.subscribe((value) => {
      results.push(value);
    });

    tappedStream.isStopped.then(() => {
      // Check if side effect function was called for each emission
      expect(sideEffectFn).toHaveBeenCalledTimes(3);

      // Verify that the emitted results are the same as the original stream
      expect(results).toEqual([1, 2, 3]);

      done();
    });
  });
});
