import { concat, createStream, eachValueFrom, from } from '@actioncrew/streamix';


describe('concat', () => {
  it('should emit values from each source in sequence', (done) => {
    const source1 = from(['source1_value1', 'source1_value2']);
    const source2 = from(['source2_value1', 'source2_value2']);

    const concatStream = concat(source1, source2);

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

    const concatStream = concat(source1, source2);
    const subscription = concatStream.subscribe({
      complete: () => {
        isCompleted = true;
        expect(isCompleted).toBe(true);
        subscription.unsubscribe();
        done();
      }
    });
  });

  it('should create a ConcatStream with provided sources', () => {
    const source1 = from(['source1_value1', 'source1_value2']);
    const source2 = from(['source2_value1', 'source2_value2']);

    const concatStream = concat(source1, source2);

    expect(concatStream).toBeInstanceOf(Object);
  });

  it('should propagate errors from the source stream', async () => {
    const errorMessage = 'Test error';
    
    const source1 = from([1, 2, 3]); // emits normally
    const source2 = createStream("errorStream", async function* () {
      throw new Error(errorMessage); // errors immediately
    });
    const source3 = from([4, 5, 6]); // should not run

    const concatenated = concat(source1, source2, source3);

    let caughtError: any = null;

    try {
      for await (const _ of eachValueFrom(concatenated)) {
        // do nothing, just consume
      }
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError.message).toBe(errorMessage);
  });
});
