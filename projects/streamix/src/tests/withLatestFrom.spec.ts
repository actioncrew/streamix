import { createStream, Emission, Stream, withLatestFrom } from '../lib';

// Mock implementation for AbstractStream

export function mockStream(values: any[]): Stream {
  // Create the custom run function for MockStream
  const run = async (stream: Stream): Promise<void> => {
    let index = 0; // Initialize index

    while (index < values.length && !stream.isStopRequested) {
      let emission: Emission = { value: values[index] }; // Create emission
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

describe('withLatestFrom operator', () => {
  it('should combine emissions with latest value from other stream', (done) => {
    const mainStream = mockStream([1, 2, 3]);
    const otherStream = mockStream(['A', 'B', 'C', 'D', 'E']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    combinedStream.onStop.once(() => {
      expect(results).toEqual([
        [1, expect.any(String)],
        [2, expect.any(String)],
        [3, expect.any(String)]
      ]);

      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[0][1]);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[1][1]);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(results[2][1]);
      done();
    });
  });

  it('should handle cases where other stream contains one value', (done) => {
    const mainStream = mockStream([1, 2, 3]);
    const otherStream = mockStream(['A']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    combinedStream.onStop.once(() => {
      expect(results).toEqual([
        [1, 'A'],
        [2, 'A'],
        [3, 'A']
      ]);
      done();
    });
  });

  it('should handle cancellation of the main stream', (done) => {
    const mainStream = mockStream([1, 2, 3]);
    const otherStream = mockStream(['A', 'B', 'C']);

    const combinedStream = mainStream.pipe(withLatestFrom(otherStream));

    let results: any[] = [];

    combinedStream.subscribe((value) => {
      results.push(value);
    });

    // Cancel the main stream immediately
    combinedStream.complete();

    combinedStream.onStop.once(() => {
      expect(results).toEqual([]);
      done();
    });
  });
});
