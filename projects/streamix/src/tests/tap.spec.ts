import { catchError, Emission, endWith, finalize, startWith, Stream, tap } from '../lib';

// Mock implementation for AbstractStream
class MockStream extends Stream {
  private values: any[];
  private index: number;

  constructor(values: any[]) {
    super();
    this.values = values;
    this.index = 0;
  }

  override async run(): Promise<void> {
    while (this.index < this.values.length && !this.isStopRequested()) {
      let emission = { value: this.values[this.index] } as Emission;
      await this.emit(emission, this.head!);

      if (emission.isFailed) {
        throw emission.error;
      }

      this.index++;
    }
    if(!this.isStopRequested()) {
      this.isAutoComplete.resolve(true);
    }
  }
}

describe('tap operator', () => {
  it('should perform side effects for each emission', (done) => {
    const testStream = new MockStream([1, 2, 3]);
    const sideEffectFn = jest.fn();

    const tappedStream = testStream.pipe(tap(sideEffectFn), startWith(0), endWith(4), catchError(console.log), finalize(() => console.log("hurra")));

    let results: any[] = [];

    tappedStream.subscribe((value) => {
      results.push(value);
    });

    tappedStream.isStopped.then(() => {
      console.log(tappedStream);
      // Check if side effect function was called for each emission
      expect(sideEffectFn).toHaveBeenCalledTimes(5);

      // Verify that the side effect function received the correct values
      expect(sideEffectFn).toHaveBeenCalledWith(1);
      expect(sideEffectFn).toHaveBeenCalledWith(2);
      expect(sideEffectFn).toHaveBeenCalledWith(3);

      // Ensure that the emitted results are the same as the original stream
      expect(results).toEqual([0, 1, 2, 3, 4]);

      done();
    });
  });
});
