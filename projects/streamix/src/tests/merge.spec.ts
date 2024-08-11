import { MergeStream, Stream } from '../lib';

// MockStream class to simulate a stream with predefined values
class MockStream extends Stream {
  private values: any[];

  constructor(values: any[]) {
    super();
    this.values = values;
  }

  override async run(): Promise<void> {
    for (const value of this.values) {
      await this.onEmission.process({emission: { value }, source:this});
    }
    this.isAutoComplete.resolve(true);
  }
}

describe('MergeStream', () => {
  it('should merge values from multiple sources', async () => {
    const source1 = new MockStream(['source1_value1', 'source1_value2']);
    const source2 = new MockStream(['source2_value1', 'source2_value2']);

    const mergeStream = new MergeStream(source1, source2);

    const emittedValues: any[] = [];
    const subscription = mergeStream.subscribe((value) => {
      emittedValues.push(value);
    });

    mergeStream.isStopped.then(() => {
      expect(emittedValues).toEqual([
        { value: 'source1_value1' },
        { value: 'source1_value2' },
        { value: 'source2_value1' },
        { value: 'source2_value2' },
      ]);

      subscription.unsubscribe();
    });
  });

  it('should complete when all sources complete', async () => {
    const source1 = new MockStream(['source1_value1', 'source1_value2']);
    const source2 = new MockStream(['source2_value1', 'source2_value2']);

    const mergeStream = new MergeStream(source1, source2);

    let isComplete = false;
    mergeStream.isAutoComplete.then(() => {
      isComplete = true;
    });

    await mergeStream.run();

    expect(isComplete).toBe(true);
  });

  it('should stop emitting after unsubscribe', async () => {
    const source1 = new MockStream(['source1_value1', 'source1_value2']);
    const source2 = new MockStream(['source2_value1', 'source2_value2']);

    const mergeStream = new MergeStream(source1, source2);

    const emittedValues: any[] = [];
    const subscription = mergeStream.subscribe((value) => {
      emittedValues.push(value);
    });

    await mergeStream.run();

    subscription.unsubscribe();

    const previousLength = emittedValues.length;
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for potential additional emissions

    expect(emittedValues.length).toBe(previousLength); // No new emissions should occur after unsubscribe
  });
});

