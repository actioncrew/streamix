import { createStream, catchError, Emission, endWith, finalize, startWith, Stream, tap } from '../lib';

export function mockStream(values: any[]): Stream {
  // Create the custom run function for MockStream
  const run = async (stream: Stream): Promise<void> => {
    let index = 0; // Initialize index

    while (index < values.length && !stream.isStopRequested) {
      const emission: Emission = { value: values[index] }; // Create emission
      await stream.onEmission.process({ emission, source: stream }); // Process emission

      if (emission.isFailed) {
        throw emission.error; // Handle error if emission failed
      }

      index++; // Increment index
    }

    if (!stream.isStopRequested) {
      stream.isAutoComplete = true; // Set auto completion flag if not stopped
    }
  };

  // Create the stream using createStream and the custom run function
  return createStream(run);
}

describe('tap operator', () => {
  it('should perform side effects for each emission', (done) => {
    const testStream = mockStream([1, 2, 3]);
    const sideEffectFn = jest.fn();

    const tappedStream = testStream.pipe(tap(sideEffectFn), startWith(0), endWith(4), catchError(console.log), finalize(() => console.log("hurra")));

    let results: any[] = [];

    tappedStream.subscribe((value) => {
      results.push(value);
    });

    tappedStream.onStop.once(() => {
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
