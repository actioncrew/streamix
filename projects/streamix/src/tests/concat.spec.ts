import { concat, createStream, Stream } from '../lib';

export function mockStream(values: any[]): Stream {
  // Create the custom run function for MockStream
  const run = async (stream: Stream): Promise<void> => {
    for (const value of values) {
      if (stream.shouldComplete()) {
        break; // Exit if completion is requested
      }
      await stream.onEmission.process({ emission: { value }, source: stream });
    }

    stream.isAutoComplete = true; // Set auto completion flag
  };

  // Create the stream using createStream and the custom run function
  return createStream(run);
}


describe('ConcatStream', () => {
  it('should emit values from each source in sequence', (done) => {
    const source1 = mockStream(['source1_value1', 'source1_value2']);
    const source2 = mockStream(['source2_value1', 'source2_value2']);

    const concatStream = concat(source1, source2);

    const emittedValues: any[] = [];
    const subscription = concatStream.subscribe(value => {
      emittedValues.push(value);
    });

    concatStream.onStop.once(() => {
      expect(emittedValues).toEqual([
        'source1_value1',
        'source1_value2',
        'source2_value1',
        'source2_value2',
      ]);

      subscription.unsubscribe();
      done();
    })
  });

  it('should complete when all sources have emitted', (done) => {
    const source1 = mockStream(['source1_value1', 'source1_value2']);
    const source2 = mockStream(['source2_value1', 'source2_value2']);

    const concatStream = concat(source1, source2);
    const subscription = concatStream.subscribe(() => {});

    let isCompleted = false;
    concatStream.onStop.once(() => {
      isCompleted = true;
      expect(isCompleted).toBe(true);
      subscription.unsubscribe();
      done();
    });
  });
});

describe('concat function', () => {
  it('should create a ConcatStream with provided sources', () => {
    const source1 = mockStream(['source1_value1', 'source1_value2']);
    const source2 = mockStream(['source2_value1', 'source2_value2']);

    const concatStream = concat(source1, source2);

    expect(concatStream).toBeInstanceOf(Function);
  });
});
