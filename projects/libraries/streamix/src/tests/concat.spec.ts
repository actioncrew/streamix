import { concat, from } from '@actioncrew/streamix';


describe('ConcatStream', () => {
  it('should emit values from each source in sequence', (done) => {
    const source1 = from(['source1_value1', 'source1_value2']);
    const source2 = from(['source2_value1', 'source2_value2']);

    const concatStream = concat([source1, source2]);

    const emittedValues: any[] = [];
    const subscription = concatStream.subscribe({
      next: (value: any) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([
          'source1_value1',
          'source1_value2',
          'source2_value1',
          'source2_value2',
        ]);

        subscription.unsubscribe();
        done();
      }
    });
  });

  it('should complete when all sources have emitted', (done) => {
    let isCompleted = false;

    const source1 = from(['source1_value1', 'source1_value2']);
    const source2 = from(['source2_value1', 'source2_value2']);

    const concatStream = concat([source1, source2]);
    const subscription = concatStream.subscribe({
      complete: () => {
        isCompleted = true;
        expect(isCompleted).toBe(true);
        subscription.unsubscribe();
        done();
      }
    });
  });
});

describe('concat function', () => {
  it('should create a ConcatStream with provided sources', () => {
    const source1 = from(['source1_value1', 'source1_value2']);
    const source2 = from(['source2_value1', 'source2_value2']);

    const concatStream = concat([source1, source2]);

    expect(concatStream).toBeInstanceOf(Object);
  });
});
