import { createStream, Emission, Stream, takeWhile } from '../lib';

// Mock implementation for AbstractStream
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

  // Create and return the stream using createStream with the custom run function
  return createStream(run);
}
describe('takeWhile operator', () => {
  it('should take emissions while predicate returns true', (done) => {
    const testStream = mockStream([1, 2, 3, 4, 5]);
    const predicate = (value: number) => value < 4;

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe((value) => {
      results.push(value);
    });

    takenWhileStream.onStop.once(() => {
      expect(results).toEqual([1, 2, 3]); // Should emit values until predicate returns false
      done();
    });
  });

  it('should handle empty stream', (done) => {
    const testStream = mockStream([]);
    const predicate = (value: any) => true; // Should never be called in an empty stream

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe((value) => {
      results.push(value);
    });

    takenWhileStream.onStop.once(() => {
      expect(results).toEqual([]); // Should not emit any values from an empty stream
      done();
    });
  });

  it('should handle immediate false predicate', (done) => {
    const testStream = mockStream([1, 2, 3]);
    const predicate = (value: number) => value > 3; // Predicate immediately returns false

    const takenWhileStream = testStream.pipe(takeWhile(predicate));

    let results: any[] = [];

    takenWhileStream.subscribe((value) => {
      results.push(value);
    });

    takenWhileStream.onStop.once(() => {
      expect(results).toEqual([]); // Should not emit any values because predicate returns false immediately
      done();
    });
  });
});
