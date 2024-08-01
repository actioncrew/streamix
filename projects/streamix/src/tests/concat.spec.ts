import { AbstractStream, concat, ConcatStream } from '../lib';

// Mock AbstractStream for testing purposes
class MockStream extends AbstractStream {
  private readonly values: any[];
  private currentIndex: number = 0;

  constructor(values: any[]) {
    super();
    this.values = values;
  }

  override async run(): Promise<void> {

    for (const value of this.values) {
      await this.emit({ value }, this.head!);
    }

    this.isAutoComplete.resolve(true);
  }
}

describe('ConcatStream', () => {
  it('should emit values from each source in sequence', (done) => {
    const source1 = new MockStream(['source1_value1', 'source1_value2']);
    const source2 = new MockStream(['source2_value1', 'source2_value2']);

    const concatStream = new ConcatStream(source1, source2);

    const emittedValues: any[] = [];
    const subscription = concatStream.subscribe(value => {
      emittedValues.push(value);
    });

    concatStream.isStopped.then(() => {
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

  // it('should cancel processing if cancelled', async () => {
  //   const source1 = new MockStream(['source1_value1', 'source1_value2']);
  //   const source2 = new MockStream(['source2_value1', 'source2_value2']);

  //   const concatStream = new ConcatStream(source1, source2);

  //   const emittedValues: any[] = [];
  //   const subscription = concatStream.subscribe(value => {
  //     emittedValues.push(value);
  //   });

  //   setTimeout(() => {
  //     concatStream.terminate();
  //   }, 10);

  //   expect(emittedValues).toEqual(['source1_value1', 'source1_value2']); // Only first source emitted

  //   subscription.unsubscribe();
  // });

  it('should complete when all sources have emitted', (done) => {
    const source1 = new MockStream(['source1_value1', 'source1_value2']);
    const source2 = new MockStream(['source2_value1', 'source2_value2']);

    const concatStream = new ConcatStream(source1, source2);
    const subscription = concatStream.subscribe(() => {});

    let isCompleted = false;
    concatStream.isStopped.then(() => {
      isCompleted = true;
      expect(isCompleted).toBe(true);
      subscription.unsubscribe();
      done();
    });
  });
});

describe('concat function', () => {
  it('should create a ConcatStream with provided sources', () => {
    const source1 = new MockStream(['source1_value1', 'source1_value2']);
    const source2 = new MockStream(['source2_value1', 'source2_value2']);

    const concatStream = concat(source1, source2) as ConcatStream;

    expect(concatStream).toBeInstanceOf(ConcatStream);
  });
});
