import { from, merge, Stream } from '../lib';

describe('MergeStream', () => {
  it('should merge values from multiple sources', (done) => {
    const source1 = from(['source1_value1', 'source1_value2']);
    const source2 = from(['source2_value1', 'source2_value2']);

    const mergeStream = merge(source1, source2);

    const emittedValues: any[] = [];
    const subscription = mergeStream.subscribe((value) => {
      emittedValues.push(value);
    });

    mergeStream.onStop.once(() => {
      expect(emittedValues).toEqual([
        'source1_value1',
        'source2_value1',
        'source1_value2',
        'source2_value2',
      ]);

      subscription.unsubscribe();
      done()
    });
  });

  it('should complete when all sources complete', (done) => {
    const source1 = from(['source1_value1', 'source1_value2']);
    const source2 = from(['source2_value1', 'source2_value2']);

    const mergeStream = merge(source1, source2);

    let subscriptionCalls = 0;

    mergeStream.subscribe(() => {
      subscriptionCalls++;
    });

    mergeStream.onStop.once(() => {
      expect(subscriptionCalls).toBe(4);
      done();
    })
  });
});

